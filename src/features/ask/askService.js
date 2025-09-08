class AskService {
    constructor() {
        this.isProcessing = false;
        this.currentModel = 'gpt-4';
    }

    async askQuestion(question) {
        this.isProcessing = true;
        console.log('Processing question:', question);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        this.isProcessing = false;
        return {
            answer: `This is a simulated response to: "${question}"`,
            model: this.currentModel,
            timestamp: new Date().toISOString()
        };
    }

    async setModel(model) {
        this.currentModel = model;
        console.log('Model set to:', model);
    }

    getCurrentModel() {
        return this.currentModel;
    }

    isCurrentlyProcessing() {
        return this.isProcessing;
    }
}

module.exports = new AskService();
