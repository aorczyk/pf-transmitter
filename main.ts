/**
 * Power Functions Transmitter - programmable remote control.
 * Sends commands to LEGO Power Functions infrared receiver.
 * 
 * LEGO Power Functions RC documentation: https://www.philohome.com/pf/LEGO_Power_Functions_RC.pdf
 * 
 * (c) 2021, Adam Orczyk
 */

const enum PfChannel {
    //% block="1"
    Channel1 = 0,
    //% block="2"
    Channel2 = 1,
    //% block="3"
    Channel3 = 2,
    //% block="4"
    Channel4 = 3,
}

const enum PfOutput {
    Red = 0,
    Blue = 1
}

const enum PfSingleOutput {
    //% block="Float"
    Float = 0b1000000,
    //% block="Forward step 1"
    Forward1 = 0b1000001,
    //% block="Forward step 2"
    Forward2 = 0b1000010,
    //% block="Forward step 3"
    Forward3 = 0b1000011,
    //% block="Forward step 4"
    Forward4 = 0b1000100,
    //% block="Forward step 5"
    Forward5 = 0b1000101,
    //% block="Forward step 6"
    Forward6 = 0b1000110,
    //% block="Forward step 7"
    Forward7 = 0b1000111,
    //% block="Brake then float"
    BrakeThenFloat = 0b1001000,
    //% block="Backward step 7"
    Backward7 = 0b1001001,
    //% block="Backward step 6"
    Backward6 = 0b1001010,
    //% block="Backward step 5"
    Backward5 = 0b1001011,
    //% block="Backward step 4"
    Backward4 = 0b1001100,
    //% block="Backward step 3"
    Backward3 = 0b1001101,
    //% block="Backward step 2"
    Backward2 = 0b1001110,
    //% block="Backward step 1"
    Backward1 = 0b1001111,

    //% block="Increment"
    IncrementPWM = 0b1100100,
    //% block="Decrement"
    DecrementPWM = 0b1100101,
    //% block="Full forward"
    FullForward = 0b1100110,
    //% block="Full backward"
    FullBackward = 0b1100111,

    //% block="Toggle full forward/backward (default forward)"
    ToggleFullForwardBackward = 0b1101000,

    //% block="Toggle full forward (Stop → Fw, Fw → Stop, Bw → Fw)"
    ToggleFullForward = 0b1100000,
    //% block="Toggle full backward (Stop → Bw, Bw → Stop, Fwd → Bw)"
    ToggleFullBackward = 0b1101111,

    //% block="Toggle direction"
    ToggleDirection = 0b1100001,
    //% block="Increment Numerical PWM"
    IncrementNumericalPWM = 0b1100010,
    //% block="Decrement Numerical PWM"
    DecrementNumericalPWM = 0b1100011,
    
    //% block="Clear C1 (negative logic – C1 high)"
    ClearC1 = 0b1101001,
    //% block="Set C1 (negative logic – C1 low)"
    SetC1 = 0b1101010,
    //% block="Toggle C1"
    ToggleC1 = 0b1101011,

    //% block="Clear C2 (negative logic – C2 high)"
    ClearC2 = 0b1101100,
    //% block="Set C2 (negative logic – C2 low)"
    SetC2 = 0b1101101,
    //% block="Toggle C2"
    ToggleC2 = 0b1101110,
}

const enum PfComboDirect {
    //% block="Float"
    Float = 0b00,
    //% block="Forward"
    Forward = 0b01,
    //% block="Backward"
    Backward = 0b10,
    //% block="Brake then float"
    BrakeThenFloat = 0b11,
}

const enum PfComboPWM {
    //% block="Float"
    Float = 0b0000,
    //% block="Forward step 1"
    Forward1 = 0b0001,
    //% block="Forward step 2"
    Forward2 = 0b0010,
    //% block="Forward step 3"
    Forward3 = 0b0011,
    //% block="Forward step 4"
    Forward4 = 0b0100,
    //% block="Forward step 5"
    Forward5 = 0b0101,
    //% block="Forward step 6"
    Forward6 = 0b0110,
    //% block="Forward step 7"
    Forward7 = 0b0111,
    //% block="Brake then float"
    BrakeThenFloat = 0b1000,
    //% block="Backward step 7"
    Backward7 = 0b1001,
    //% block="Backward step 6"
    Backward6 = 0b1010,
    //% block="Backward step 5"
    Backward5 = 0b1011,
    //% block="Backward step 4"
    Backward4 = 0b1100,
    //% block="Backward step 3"
    Backward3 = 0b1101,
    //% block="Backward step 2"
    Backward2 = 0b1110,
    //% block="Backward step 1"
    Backward1 = 0b1111,
}

//% color=#f68420 icon="\uf1eb" block="PF Transmitter"
namespace pfTransmitter {
    let irLed: InfraredLed;
    let toggleByChannel: number[] = [1, 1, 1, 1];
    let schedulerIsWorking: boolean = false;
    let tasks: task[] = [];
    let intervalId: number[] = [null, null, null, null];
    let settings = {
        repeatCommandAfter: 500,
        afterSignalPause: 0,
        signalRepeatNumber: 5
    }

    class InfraredLed {
        private pin: AnalogPin;
        private waitCorrection: number;
        public debug: boolean = false;

        constructor(pin: AnalogPin) {
            this.pin = pin;
            pins.analogWritePin(this.pin, 0);
            pins.analogSetPeriod(this.pin, 26);

            // Measure the time we need for a minimal bit (analogWritePin and waitMicros)
            {
                const start = input.runningTimeMicros();
                const runs = 32;
                for (let i = 0; i < runs; i++) {
                    this.transmitBit(1, 1);
                }
                const end = input.runningTimeMicros();
                this.waitCorrection = Math.idiv(end - start - runs * 2, runs * 2);
            }

            // Insert a pause between callibration and first message
            control.waitMicros(2000);
        }

        public transmitBit(highMicros: number, lowMicros: number): void {
            pins.analogWritePin(this.pin, 511);
            control.waitMicros(highMicros);
            pins.analogWritePin(this.pin, 1);
            control.waitMicros(lowMicros);
        }

        // 12 bits of datagram
        public sendCommand(command: number) {
            let nibble1 = command >>> 8;
            let nibble2 = (command & 0b000011110000) >>> 4;
            let nibble3 = (command & 0b000000001111);
            let lrc = 15 ^ nibble1 ^ nibble2 ^ nibble3;

            this.sendDatagram((command << 4) | lrc)
        }

        public sendDatagram(datagram: number): void {
            const PF_MARK_BIT = 158;
            const PF_LOW_BIT = 421 - PF_MARK_BIT - this.waitCorrection;
            const PF_HIGH_BIT = 711 - PF_MARK_BIT - this.waitCorrection;
            const PF_START_BIT = 1184 - PF_MARK_BIT - this.waitCorrection;

            let bits = '';

            this.transmitBit(PF_MARK_BIT, PF_START_BIT);

            for (let i = 15; i >= 0; i--){
                let bit = (datagram & (1 << i)) === 0 ? 0 : 1;

                bits += (i > 0 && i % 4 == 0) ? bit + '-' : bit;

                if (bit == 0) {
                    this.transmitBit(PF_MARK_BIT, PF_LOW_BIT);
                } else if (bit == 1) {
                    this.transmitBit(PF_MARK_BIT, PF_HIGH_BIT);
                }
            }

            this.transmitBit(PF_MARK_BIT, PF_START_BIT);

            if (this.debug) {
                serial.writeString(bits + "\n")
            }
        }
    }

    // --- Command sender ---
    // To achieve greater parallelization of signals, mixes ir signals when more than one command is run one by one.
    
    interface task {
        handler: () => void;
        type: number;
    }

    function getRandomInt(min: number, max: number) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    function addToggle(command: number){
        let channel = (0b001100000000 & command) >>> 8;
        toggleByChannel[channel] = 1 - toggleByChannel[channel];

        return (toggleByChannel[channel] << 11) | command;
    }

    function sendPacket(command: number, mixDatagrams: boolean = false) {
        let taskType = 0b001100110000 & command;
        command = addToggle(command);

        if (mixDatagrams){
            // Prevents from mixing two commands to the same output ex. start and stop.
            while (tasks.filter(x => { return x.type == taskType}).length > 0) {
                basic.pause(20)
            }
        }

        // "Five exactly matching messages (if no other buttons are pressed or released) are sent ... ."
        // "(if no other buttons are pressed or released)" - this is not handle now, every command is sent one by one or mixed. It should be handled by receiver.
        for (let i = 0; i < settings.signalRepeatNumber; i++) {
            tasks.push({
                handler: () => {
                    irLed.sendCommand(command)
                }, 
                type: taskType
            })
        }

        // Pause after each command packet - seems not needed.
        // if (!mixDatagrams) {
        //     tasks.push({
        //         handler: () => {},
        //         type: taskType
        //     })
        // }

        if (!schedulerIsWorking){
            schedulerIsWorking = true;

            control.inBackground(function() {
                let start = input.runningTime();

                while(tasks.length > 0){
                    let i = 0;
                    if (mixDatagrams) {
                        i = getRandomInt(0, tasks.length - 1);
                    }
                    tasks[i].handler();
                    tasks.splice(i, 1);
                    
                    // Pause time after each signal.
                    basic.pause(settings.afterSignalPause)
                }
                
                schedulerIsWorking = false;
            })
        }
    }

    function repeatCommand(channel: PfChannel, command: number, datagram: number, excluded: number[]) {
        if (intervalId[channel]) {
            control.clearInterval(intervalId[channel], control.IntervalMode.Interval)
            intervalId[channel] = null;
        }

        sendPacket(datagram);

        if (!excluded.some(x => x == command)) {
            intervalId[channel] = control.setInterval(() => {
                sendPacket(datagram);
            }, settings.repeatCommandAfter, control.IntervalMode.Interval)
        }
    }

    /**
     * Connects to the IR-emitting diode at the specified pin. Warning! The light (solar or lamp) falling on the diode or ir receiver interferes with the signal transmission.
     * @param pin IR diode pin, eg: AnalogPin.P0
     */
    //% blockId="pf_transmitter_infrared_sender_connect"
    //% block="connect IR sender diode at pin %pin"
    //% pin.fieldEditor="gridpicker"
    //% pin.fieldOptions.columns=4
    //% pin.fieldOptions.tooltips="false"
    //% weight=90
    export function connectIrSenderLed(pin: AnalogPin, debug = false): void {
        irLed = new InfraredLed(pin);
        irLed.debug = debug
    }

    /**
     * Single output mode (speed remote control).
     * This mode is able to control: One output at a time with PWM or clear/set/toggle control pins.
     * This mode has no timeout for lost IR on all commands except "full forward" and "full backward".
     * @param channel the PF receiver channel, eg: PfChannel.Channel1
     * @param output the PF receiver output, eg: PfOutput.Red
     * @param command the Single Output Mode command, eg: PfSingleOutput.Forward7
     */
    //% blockId="pf_transmitter_single_output_mode"
    //% block="set speed : channel %channel output %output command %command"
    //% weight=80
    export function singleOutputMode(channel: PfChannel, output: PfOutput, command: PfSingleOutput){
        let mixDatagrams = true;

        // Because: Toggle bit is verified on receiver if increment/decrement/toggle command is received.
        if ([0b1100100, 0b1100101].some(x => x == command)){
            mixDatagrams = false
        }

        sendPacket((channel << 8) | command | (output << 4), mixDatagrams)
    }

    /**
     * Combo direct mode (ordinary remote control).
     * Controlling the state of both output A and B at the same time.
     * This mode has timeout for lost IR.
     * @param channel the PF receiver channel, eg: PfChannel.Channel1
     * @param red the red output Combo Direct Mode command, eg: PfComboDirect.Forward
     * @param blue the blue output Combo Direct Mode command, eg: PfComboDirect.Forward
     */
    //% blockId="pf_transmitter_combo_direct_mode"
    //% block="set state of outputs : channel %channel red %red blue %blue"
    //% weight=70
    export function comboDirectMode(channel: PfChannel, red: PfComboDirect, blue: PfComboDirect){
        let command: number = (blue << 2) | red;
        let datagram = (channel << 8) | 0b00010000 | command;

        repeatCommand(channel, command, datagram, [0, 15])
    }

    /**
     * Combo PWM mode. 
     * Controlling the state of both output A and B at the same time.
     * This mode has timeout for lost IR.
     * @param channel the PF receiver channel, eg: PfChannel.Channel1
     * @param red the red output Combo PWM Mode command, eg: PfComboPWM.Forward7
     * @param blue the blue output Combo PWM Mode command, eg: PfComboPWM.Forward7
     */
    //% blockId="pf_transmitter_combo_pwm_mode"
    //% block="set speed of outputs : channel %channel red %red blue %blue"
    //% weight=60
    export function comboPWMMode(channel: PfChannel, red: PfComboPWM, blue: PfComboPWM) {
        let command: number = (blue << 4) | red;
        let datagram = ((0b0100 | channel) << 8) | command;

        repeatCommand(channel, command, datagram, [0, 136])
    }

    /**
     * Advanced settings.
     * @param repeatCommandAfter the time after which combo command is repeated (ms), eg: 500
     * @param afterSignalPause the pause before sending next signal in package (ms), eg: 0
     * @param signalRepeatNumber the number of signals in package, eg: 5
     */
    //% blockId=pf_transmitter_settings
    //% block="advanced settings: repeatCommandAfter %repeatCommandAfter | afterSignalPause %afterSignalPause | signalRepeatNumber %signalRepeatNumber"
    //% weight=40
    export function advancedSettings(
        repeatCommandAfter: number = 500,
        afterSignalPause: number = 0,
        signalRepeatNumber: number = 5) {

        settings.repeatCommandAfter = repeatCommandAfter;
        settings.afterSignalPause = afterSignalPause;
        settings.signalRepeatNumber = signalRepeatNumber;
    }
}