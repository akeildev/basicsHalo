class ModelStateService {
    constructor() {
        this.models = {
            openai: ['gpt-4', 'gpt-3.5-turbo'],
            anthropic: ['claude-3-opus', 'claude-3-sonnet'],
            google: ['gemini-pro', 'gemini-pro-vision']
        };
        this.currentModel = 'gpt-4';
        this.modelStates = new Map();
    }

    async getAvailableModels() {
        return this.models;
    }

    async setCurrentModel(model) {
        this.currentModel = model;
        console.log('Current model set to:', model);
    }

    async getCurrentModel() {
        return this.currentModel;
    }

    async getModelState(model) {
        return this.modelStates.get(model) || {
            isAvailable: true,
            lastUsed: null,
            usage: 0
        };
    }

    async updateModelState(model, state) {
        this.modelStates.set(model, {
            ...this.getModelState(model),
            ...state,
            lastUsed: new Date().toISOString()
        });
    }

    async getModelUsage(model) {
        const state = await this.getModelState(model);
        return state.usage;
    }

    async incrementModelUsage(model) {
        const state = await this.getModelState(model);
        await this.updateModelState(model, { usage: state.usage + 1 });
    }
}

module.exports = new ModelStateService();
