import * as application from "tns-core-modules/application";

declare var com: any;

export class AudioInputHandler extends com.amazon.aace.audio.AudioInput {
    // All audio input consumers expect PCM 16 data @ 16 Khz. We divide this consumption into 10 ms
    // chunks. It comes out at 160 samples every 10 ms to reach 16000 samples (in a second).
    private static sSamplesToCollectInOneCycle = 160;
    private static sBytesInEachSample = 2; // PCM 16 = 2 bytes per sample
    private static sSampleRateInHz = 16000; //16 khz
    private static sAudioFramesInBuffer = 5; // Create large enough buffer for 5 audio frames.

    private mActivity: any;
    private mExecutor = java.util.concurrent.Executors.newFixedThreadPool( 1 );

    private mAudioInput: any;
    private mReaderRunnable: any;

    constructor(activity) {
        super();
        this.mActivity = activity;
        this.mAudioInput = this.createAudioInput();
    }

    private createAudioInput() {
        let audioRecord = null;
        try {
            const minBufferSize = android.media.AudioRecord.getMinBufferSize(
                this.sSampleRateInHz,
                android.media.AudioFormat.CHANNEL_IN_MONO,
                android.media.AudioFormat.ENCODING_PCM_16BIT);
            const bufferSize = minBufferSize + (
                this.sAudioFramesInBuffer * this.sSamplesToCollectInOneCycle * this.sBytesInEachSample);
            audioRecord = new android.media.AudioRecord(
                android.media.MediaRecorder.AudioSource.MIC, this.sSampleRateInHz,
                android.media.AudioFormat.CHANNEL_IN_MONO, android.media.AudioFormat.ENCODING_PCM_16BIT,
                bufferSize);
        } catch (e) {}
        return audioRecord;
    }

    public startAudioInput() {
        if (this.mAudioInput == null) {
            return false;
        }

        if (this.mAudioInput.getState() != android.media.AudioRecord.STATE_INITIALIZED) {
            // Retry AudioRecord initialization.
            this.mAudioInput = this.createAudioInput();
            if ( this.mAudioInput.getState() != android.media.AudioRecord.STATE_INITIALIZED ) {
                return false;
            }
        }

        return this.startRecording();
    }

    public stopAudioInput() {
        if (this.mAudioInput == null) {
            return false;
        }

        // Cancel the audio reader and stop recording
        if (this.mReaderRunnable != null) this.mReaderRunnable.cancel();
        try {
            this.mAudioInput.stop();
        } catch (e) {
            return false;
        }

        return true;
    }

    private startRecording() {
        if (this.mReaderRunnable != null && this.mReaderRunnable.isRunning()) {
            return false;
        } else {
            // Start audio recording
            try {
                this.mAudioInput.startRecording();
            } catch ( e ) {
                return false;
            }

            // Read recorded audio samples and pass to engine
            try {
                this.mExecutor.submit( this.mReaderRunnable = new this.AudioReaderRunnable() ); // Submit the audio reader thread
            } catch ( e) {
                return false;
            }
            return true;
        }
    }

    //
    // AudioReader class
    //
    private AudioReaderRunnable = class AudioReaderRunnable implements java.lang.Runnable {
        public wait(): void;
        public wait(param0: number): void;
        public wait(param0: number, param1: number): void;
        public wait(param0?: any, param1?: any) {
            throw new Error("Method not implemented.");
        }
        public equals(param0: any): boolean {
            throw new Error("Method not implemented.");
        }
        public clone() {
            throw new Error("Method not implemented.");
        }
        public toString(): string {
            throw new Error("Method not implemented.");
        }
        public notify(): void {
            throw new Error("Method not implemented.");
        }
        public getClass(): java.lang.Class<any> {
            throw new Error("Method not implemented.");
        }
        public finalize(): void {
            throw new Error("Method not implemented.");
        }
        public hashCode(): number {
            throw new Error("Method not implemented.");
        }
        public notifyAll(): void {
            throw new Error("Method not implemented.");
        }
        private mRunning = true;
        private mBuffer = new byte[sSamplesToCollectInOneCycle * sBytesInEachSample];

        cancel() { this.mRunning = false; }

        isRunning() { return this.mRunning; }

        public run() {
            let size: number;

            while (this.mRunning) {
                size = this.mAudioInput.read(mBuffer, 0, mBuffer.length);
                if ( size > 0 && mRunning ) {
                    write( mBuffer, size );
                }
            }
        }
    }
}
