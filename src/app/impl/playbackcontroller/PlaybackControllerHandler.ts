import * as application from "tns-core-modules/application";

declare var com: any;

export class PlaybackControllerHandler extends com.amazon.aace.alexa.PlaybackController {

    private mActivity: any;
    private mStringBuilder: any;
    private mFormatter: any;
    private mCurrentProvider = "";
    private mProgressTime:any;
    private mEndTime:any;
    private mTitle:any;
    private mArtist:any;
    private mProvider:any;

    private mControlPrev:any;
    private mControlNext:any;
    private mControlSkipForward:any;
    private mControlSkipBackward;

    private mControlPlayPause:any;
    private mShuffleToggle: any;
    private mLoopToggle: any;
    private mRepeatToggle: any;
    private mThumbsUpToggle: any;
    private mThumbsDownToggle;

    private mProgress: any;
    private mCurrentDuration = com.amazon.aace.audio.AudioOutput.TIME_UNKNOWN;

    constructor(activity) {
        super();
        this.mActivity = activity;
        this.mStringBuilder = new java.lang.StringBuilder();
        this.mFormatter = new java.util.Formatter( this.mStringBuilder, java.util.Locale.US );
    }

    public setPlayerInfo( title: string, artist: string, provider: string ) {
        const thas = this;
        this.mCurrentProvider = provider;

        const runnable =  new java.lang.Runnable();
        runnable.run = function () {
            thas.mTitle.setText( title );
            thas.mArtist.setText( artist );
            thas.mProvider.setText( provider );
        }
        this.mActivity.runOnUiThread(runnable);
    }

    public getProvider(){
        return this.mCurrentProvider;
    }

    public start() {
        const thas = this;
        const runnable =  new java.lang.Runnable();
        runnable.run = function () {
            thas.mControlPrev.setEnabled( true );
            thas.mControlPlayPause.setEnabled( true );
            thas.mControlPlayPause.setChecked(true);
            thas.mControlNext.setEnabled( true );
            thas.mProgress.setMax( 1000 );
        }
        this.mActivity.runOnUiThread(runnable);
    }

    public stop() {
        const thas = this;
        const runnable =  new java.lang.Runnable();
        runnable.run = function () {
            thas.mControlPlayPause.setChecked(false);
        }
        this.mActivity.runOnUiThread(runnable);
    }

    public reset() {
        const thas = this;
        const runnable =  new java.lang.Runnable();
        runnable.run = function () {
            thas.mControlPlayPause.setChecked(false);
            thas.mControlPrev.setEnabled( false );
            thas.mControlPlayPause.setEnabled( false );
            thas.mControlNext.setEnabled( false );
            thas.resetProgress();
            thas.setPlayerInfo( "", "", "" );
        }
        this.mActivity.runOnUiThread(runnable);
    }

    // Updates Control Button's states
    public updateControlButton( name: string, enabled: boolean ) {
        const thas = this;
        const runnable =  new java.lang.Runnable();
        runnable.run = function () {
            switch ( name ) {
                case "PREVIOUS":
                    thas.mControlPrev.setEnabled( enabled );
                    break;
                case "PLAY_PAUSE":
                    thas.mControlPlayPause.setEnabled( enabled );
                    break;
                case "NEXT":
                    thas.mControlNext.setEnabled( enabled );
                    break;
                case "SKIP_FORWARD":
                    thas.mControlSkipForward.setVisibility( android.view.View.VISIBLE );
                    thas.mControlSkipForward.setEnabled( enabled );
                    break;
                case "SKIP_BACKWARD":
                    thas.mControlSkipBackward.setVisibility( android.view.View.VISIBLE );
                    thas.mControlSkipBackward.setEnabled( enabled );
                    break;
            }
        }
        this.mActivity.runOnUiThread(runnable);
    }

    // Updates Toggle's display states
    // NOTE: Disabled controls not hidden here for development visibility.
    public updateControlToggle( name: string, enabled: boolean, selected: boolean ) {
        const thas = this;
        const runnable =  new java.lang.Runnable();
        runnable.run = function () {
            switch ( name ) {
                case "SHUFFLE":
                    thas.mShuffleToggle.setVisibility( android.view.View.VISIBLE );
                    thas.mShuffleToggle.setEnabled( enabled );
                    thas.mShuffleToggle.setChecked( selected );
                    break;
                case "LOOP":
                    thas.mLoopToggle.setVisibility( android.view.View.VISIBLE );
                    thas.mLoopToggle.setEnabled( enabled );
                    thas.mLoopToggle.setChecked( selected );
                    break;
                case "REPEAT":
                    thas.mRepeatToggle.setVisibility( android.view.View.VISIBLE );
                    thas.mRepeatToggle.setEnabled( enabled );
                    thas.mRepeatToggle.setChecked( selected );
                    break;
                case "THUMBS_UP":
                    thas.mThumbsUpToggle.setVisibility( android.view.View.VISIBLE );
                    thas.mThumbsUpToggle.setEnabled( enabled );
                    thas.mThumbsUpToggle.setChecked( selected );
                    break;
                case "THUMBS_DOWN":
                    thas.mThumbsDownToggle.setVisibility( android.view.View.VISIBLE );
                    thas.mThumbsDownToggle.setEnabled( enabled );
                    thas.mThumbsDownToggle.setChecked( selected );
                    break;
            }
        }
        this.mActivity.runOnUiThread(runnable);
    }

    public hidePlayerInfoControls(){
        const thas = this;
        const runnable =  new java.lang.Runnable();
        runnable.run = function () {
            thas.mControlSkipForward.setVisibility( android.view.View.GONE );
            thas.mControlSkipBackward.setVisibility( android.view.View.GONE );

            thas.mShuffleToggle.setVisibility( android.view.View.GONE );
            thas.mLoopToggle.setVisibility( android.view.View.GONE );
            thas.mRepeatToggle.setVisibility( android.view.View.GONE );
            thas.mThumbsUpToggle.setVisibility( android.view.View.GONE );
            thas.mThumbsDownToggle.setVisibility( android.view.View.GONE );
        }
        this.mActivity.runOnUiThread(runnable);
    }

    private resetProgress() {
        const thas = this;
        const runnable =  new java.lang.Runnable();
        runnable.run = function () {
            thas.mProgress.setProgress( 0 );
            thas.mProgressTime.setText( thas.stringForTime( com.amazon.aace.audio.AudioOutput.TIME_UNKNOWN )  );
            thas.mEndTime.setText( thas.stringForTime( com.amazon.aace.audio.AudioOutput.TIME_UNKNOWN ) );
        }
        this.mActivity.runOnUiThread(runnable);
    }

    public setTime( position, duration ) {
        if( this.mCurrentDuration != duration )
        {
            this.mEndTime.setText( this.stringForTime( duration ) );
            this.mCurrentDuration = duration;
        }
        else
        {
            this.mProgress.setProgress( (1000 * position / duration));
        }

        this.mProgressTime.setText( this.stringForTime( position ) );
    }

    private stringForTime( timeMs: number ) {
        if( timeMs == com.amazon.aace.audio.AudioOutput.TIME_UNKNOWN ) {
            return "-:--";
        }

        const totalSeconds = timeMs / 1000;
        const seconds = totalSeconds % 60;
        const minutes = ( totalSeconds / 60 ) % 60;
        const hours   = totalSeconds / 3600;

        this.mStringBuilder.setLength( 0 );
        if ( hours > 0 ) {
            return this.mFormatter.format( "%d:%02d:%02d", hours, minutes, seconds ).toString();
        } else {
            return this.mFormatter.format( "%02d:%02d", minutes, seconds ).toString();
        }
    }
}
