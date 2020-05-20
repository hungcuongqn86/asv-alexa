import * as application from "tns-core-modules/application";

declare var com: any;

export class AudioPlayerHandler extends com.amazon.aace.alexa.AudioPlayer {

    public mAudioOutputProvider:any = null;
    public mPlaybackController:any = null;
    public mAudioPlayerStateHandler:any = null;
    public UPDATE_PROGRESS = java.lang.Integer.MAX_VALUE;

    constructor(audioOutputProvider:any, playbackController:any) {
        super();
        this.mPlaybackController = playbackController;
        this.mAudioOutputProvider = audioOutputProvider;
        this.mAudioPlayerStateHandler = new AudioPlayerStateHandler(this);
    }

    public playerActivityChanged(state: any) {
        this.mAudioPlayerStateHandler.sendEmptyMessage( state.ordinal() );
    }
}

export class AudioPlayerStateHandler extends android.os.Handler
{
    constructor(private audioPlayerHandler: AudioPlayerHandler) {
        super();
    }

    public handleMessage( msg ){
        if( msg.what == this.audioPlayerHandler.UPDATE_PROGRESS ){
            const audioOutput = this.audioPlayerHandler.mAudioOutputProvider.getOutputChannel( "AudioPlayer" );

            if( audioOutput != null ){
                let position = audioOutput.getPosition();

                if(audioOutput.getDuration() == com.amazon.aace.audioAudioOutput.TIME_UNKNOWN) {
                    position = com.amazon.aace.audioAudioOutput.TIME_UNKNOWN;
                }

                this.audioPlayerHandler.mPlaybackController.setTime( position, audioOutput.getDuration() );

                this.sendEmptyMessageDelayed( this.audioPlayerHandler.UPDATE_PROGRESS, 1000 - (position % 1000) );
            }
        } else if( msg.what == com.amazon.aace.alexa.AudioPlayer.PlayerActivity.PLAYING.ordinal() ) {
            this.audioPlayerHandler.mPlaybackController.start();
            this.sendEmptyMessage( this.audioPlayerHandler.UPDATE_PROGRESS );
        } else if( msg.what == com.amazon.aace.alexa.AudioPlayer.PlayerActivity.STOPPED.ordinal() ) {
            this.audioPlayerHandler.mPlaybackController.stop();
            this.removeMessages( this.audioPlayerHandler.UPDATE_PROGRESS );
        } else if( msg.what == com.amazon.aace.alexa.AudioPlayer.PlayerActivity.FINISHED.ordinal() ) {
            this.audioPlayerHandler.mPlaybackController.reset();
            this.removeMessages( this.audioPlayerHandler.UPDATE_PROGRESS );
        }
    }
}
