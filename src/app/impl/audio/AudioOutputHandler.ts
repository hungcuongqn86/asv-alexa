import * as application from "tns-core-modules/application";
import {AuthStateObserver} from "./AuthStateObserver";

declare var com: any;

export class AudioOutputHandler extends com.amazon.aace.audio.AudioOutput implements AuthStateObserver {
    private sFileName = "alexa_media"; // Note: not thread safe

    private mActivity: any;
    private mContext: any;
    private mName: string;
    private mMediaSourceFactory: any;
    private mPlayer: any;
    private mRepeating: any;

    private mVolume = 0.5;
    private mMutedState = com.amazon.aace.audio.AudioOutput.MutedState.UNMUTED;

    private mPeriod: any;
    private mPosition: number;
    private mLivePausedPosition: number;
    private mSavedPeriodIndex: number;
    private mLivePausedOffset: number;
    private mLiveResumedOffset: number;
    private mNewPlayReceieved: boolean;

    constructor(activity: any, name: string) {
        super();
        this.mActivity = activity;
        this.mContext = activity.getApplicationContext();
        this.mName = name;
        this.mMediaSourceFactory = new com.amazon.impl.Audio.MediaSourceFactory(this.mContext, this.mName);
        this.mRepeating = false;
        this.mPeriod = new com.google.android.exoplayer2.Timeline.Period();

        this.initializePlayer();
    }

    private initializePlayer() {
        this.mPlayer = com.google.android.exoplayer2.ExoPlayerFactory.newSimpleInstance(this.mContext, new com.google.android.exoplayer2.DefaultTrackSelector());
        this.mPlayer.addListener(new PlayerEventListener(this));
        this.mPlayer.setPlayWhenReady(false);
    }

    public resetPlayer() {
        this.mPlayer.setRepeatMode(com.google.android.exoplayer2.Player.REPEAT_MODE_OFF);
        this.mPlayer.setPlayWhenReady(false);
        this.mPlayer.stop(true);
        // reset live station offsets
        this.mLiveResumedOffset = 0;
        this.mLivePausedPosition = 0;
    }

    public isPlaying() {
        return this.mPlayer != null && this.mPlayer.getPlayWhenReady()
            && (this.mPlayer.getPlaybackState() == com.google.android.exoplayer2.Player.STATE_BUFFERING
                || this.mPlayer.getPlaybackState() == com.google.android.exoplayer2.Player.STATE_READY);
    }

    public prepare(stream, repeating: boolean) {
        this.resetPlayer();
        this.mRepeating = repeating;
        if (typeof stream === "string") {
            const uri = android.net.Uri.parse(stream);
            try {
                const mediaSource = this.mMediaSourceFactory.createHttpMediaSource(uri);
                this.mPlayer.prepare(mediaSource, true, false);
                return true;
            } catch (e) {
                const message = e.getMessage() != null ? e.getMessage() : "";
                com.amazon.aace.audio.AudioOutput.mediaError(com.amazon.aace.audio.AudioOutput.MediaError.MEDIA_ERROR_UNKNOWN, message);
                return false;
            }
        } else {
            try {
                const os = this.mContext.openFileOutput(this.sFileName, android.content.Context.MODE_PRIVATE);
                const buffer = [4096];
                let size;
                while (!stream.isClosed()) {
                    while ((size = stream.read(buffer)) > 0) os.write(buffer, 0, size);
                }
            } catch (e) {
                return false;
            }

            try {
                const uri = android.net.Uri.fromFile(this.mContext.getFileStreamPath(this.sFileName));
                const mediaSource = this.mMediaSourceFactory.createFileMediaSource(uri);
                this.mPlayer.prepare(mediaSource, true, false);
                return true;
            } catch (e) {
                const message = e.getMessage() != null ? e.getMessage() : "";
                com.amazon.aace.audio.AudioOutput.mediaError(com.amazon.aace.audio.AudioOutput.MediaError.MEDIA_ERROR_UNKNOWN, message);
                return false;
            }
        }
    }

    public play() {
        this.mNewPlayReceieved = true; // remember new play received
        this.mSavedPeriodIndex = this.mPlayer.getCurrentPeriodIndex(); // remember period index
        this.mPlayer.setPlayWhenReady( true );
        return true;
    }

    public stop() {
        if ( !this.mPlayer.getPlayWhenReady() ) {
            // Player is already not playing. Notify Engine of stop
            this.onPlaybackStopped();
        } else this.mPlayer.setPlayWhenReady( false );
        return true;
    }

    public pause() {
        const currentTimeline = this.mPlayer.getCurrentTimeline();
        if( !currentTimeline.isEmpty() && this.mPlayer.isCurrentWindowDynamic() ) { // If pausing live station.
            this.mLivePausedOffset = 0;
            this.mLivePausedPosition = this.mPosition; // save paused position
        }

        this.mPlayer.setPlayWhenReady( false );
        return true;
    }

    public resume() {
        const currentTimeline = this.mPlayer.getCurrentTimeline();
        if ( !currentTimeline.isEmpty() && this.mPlayer.isCurrentWindowDynamic() ) {  // If resuming live station reset to 0.
            this.mPlayer.seekToDefaultPosition(); // reset player position to its default
            this.mLivePausedOffset = Math.abs( this.mPlayer.getCurrentPosition() ); // get the new position
            this.mLivePausedOffset -= currentTimeline.getPeriod(this.mSavedPeriodIndex, this.mPeriod).getPositionInWindowMs(); // adjust for window
            this.mLivePausedOffset -= this.mLiveResumedOffset; // adjust for stopped offset
            this.mLivePausedOffset -= this.mLivePausedPosition; // adjust for paused offset

            this.mLivePausedPosition = 0; // reset paused position
        }

        this.mPlayer.setPlayWhenReady( true );
        return true;
    }

    public setPosition( position: number ) {
        this.mPlayer.seekTo( position );
        this.mLiveResumedOffset -= position;
        return true;
    }

    public getPosition() {
        const currentTimeline = this.mPlayer.getCurrentTimeline();
        this.mPosition = Math.abs( this.mPlayer.getCurrentPosition() );
        if ( !currentTimeline.isEmpty() && this.mPlayer.isCurrentWindowDynamic() ) {
            if ( this.mLivePausedPosition == 0 ) { // not during pause
                this.mPosition -= currentTimeline.getPeriod(this.mSavedPeriodIndex, this.mPeriod).getPositionInWindowMs(); // Adjust position to be relative to start of period rather than window.
                this.mPosition -= this.mLiveResumedOffset; // Offset saved for live station stopped / played
                this.mPosition -= this.mLivePausedOffset; // Offset saved for live station paused / resumed
            } else{
                return this.mLivePausedPosition; // the saved position during a live station paused state
            }
        }
        return this.mPosition;
    }

    public getDuration() {
        const duration = this.mPlayer.getDuration();
        return duration != com.google.android.exoplayer2.C.TIME_UNSET ? duration : com.amazon.aace.audio.AudioOutput.TIME_UNKNOWN;
    }

    public volumeChanged( volume ) {
        if( this.mVolume != volume ) {
            this.mVolume = volume;
            if ( this.mMutedState == com.amazon.aace.audio.AudioOutput.MutedState.MUTED ) {
                this.mPlayer.setVolume( 0 );
            } else {
                this.mPlayer.setVolume( volume );
            }
        }
        return true;
    }

    public mutedStateChanged( state ) {
        if( state != this.mMutedState ) {
            this.mPlayer.setVolume( state == this.MutedState.MUTED ? 0 : this.mVolume );
            this.mMutedState = state;
        }
        return true;
    }

    public onAuthStateChanged(state: any, error: any, token: string) {
        if (state == com.amazon.aace.alexa.AuthState.AuthState.UNINITIALIZED) {
            // Stop playing media if user logs out
            stop();
        }
    }

    //
    // Handle ExoPlayer state changes and notify Engine
    //

    public onPlaybackStarted() {
        com.amazon.aace.audio.AudioOutput.mediaStateChanged(com.amazon.sampleapp.aace.audio.AudioOutput.MediaState.PLAYING);

        if (this.mNewPlayReceieved && this.mPlayer.isCurrentWindowDynamic()) { // remember offset if new play for live station
            this.mPlayer.seekToDefaultPosition();
            this.mLiveResumedOffset += Math.abs(this.mPlayer.getCurrentPosition());
            this.mNewPlayReceieved = false;
        }
    }

    public onPlaybackStopped() {
        com.amazon.aace.audio.AudioOutput.mediaStateChanged(com.amazon.sampleapp.aace.audio.AudioOutput.MediaState.STOPPED);
    }

    public onPlaybackFinished() {
        if (this.mRepeating) {
            this.mPlayer.seekTo(0);
            this.mPlayer.setRepeatMode(com.google.android.exoplayer2.Player.REPEAT_MODE_ONE);
        } else {
            this.mPlayer.setRepeatMode(com.google.android.exoplayer2.Player.REPEAT_MODE_OFF);
            com.amazon.aace.audio.AudioOutput.mediaStateChanged(com.amazon.sampleapp.aace.audio.AudioOutput.MediaState.STOPPED);
        }
    }

    public onPlaybackBuffering() {
        com.amazon.aace.audio.AudioOutput.mediaStateChanged(com.amazon.sampleapp.aace.audio.AudioOutput.MediaState.BUFFERING);
    }
}

//
// ExoPlayer event listener
//
export class PlayerEventListener extends com.google.android.exoplayer2.Player.DefaultEventListener {
    constructor(public audioOutputHandler: AudioOutputHandler) {
        super();
    }

    public onPlayerStateChanged(playWhenReady: boolean, playbackState: number) {
        switch (playbackState) {
            case com.google.android.exoplayer2.Player.STATE_ENDED:
                if (playWhenReady) this.audioOutputHandler.onPlaybackFinished();
                break;
            case com.google.android.exoplayer2.Player.STATE_READY:
                if (playWhenReady) this.audioOutputHandler.onPlaybackStarted();
                else this.audioOutputHandler.onPlaybackStopped();
                break;
            case com.google.android.exoplayer2.Player.STATE_BUFFERING:
                if (playWhenReady) this.audioOutputHandler.onPlaybackBuffering();
                break;
            default:
                // Disregard other states
                break;
        }
    }

    public onPlayerError(e) {
        let message: string;
        if (e.type == com.google.android.exoplayer2.ExoPlaybackException.TYPE_SOURCE) {
            message = "ExoPlayer Source Error: " + e.getSourceException().getMessage();
        } else if (e.type == com.google.android.exoplayer2.ExoPlaybackException.TYPE_RENDERER) {
            message = "ExoPlayer Renderer Error: " + e.getRendererException().getMessage();
        } else if (e.type == com.google.android.exoplayer2.ExoPlaybackException.TYPE_UNEXPECTED) {
            message = "ExoPlayer Unexpected Error: " + e.getUnexpectedException().getMessage();
        } else {
            message = e.getMessage();
        }
        com.amazon.aace.audio.AudioOutput.mediaError(com.amazon.aace.audio.AudioOutput.MediaError.MEDIA_ERROR_INTERNAL_DEVICE_ERROR, message);
    }
}
