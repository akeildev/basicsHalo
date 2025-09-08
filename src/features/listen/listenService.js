class ListenService {
    constructor() {
        this.isListening = false;
        this.isTranscribing = false;
    }

    async startListening() {
        this.isListening = true;
        console.log('Listen service started');
    }

    async stopListening() {
        this.isListening = false;
        console.log('Listen service stopped');
    }

    async startTranscription() {
        this.isTranscribing = true;
        console.log('Transcription started');
    }

    async stopTranscription() {
        this.isTranscribing = false;
        console.log('Transcription stopped');
    }

    getStatus() {
        return {
            isListening: this.isListening,
            isTranscribing: this.isTranscribing
        };
    }
}

module.exports = new ListenService();
