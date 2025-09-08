class OllamaModelRepository {
    constructor() {
        this.models = new Map();
        this.defaultModels = [
            { name: 'llama2', size: '3.8GB', description: 'Meta\'s Llama 2 model' },
            { name: 'codellama', size: '3.8GB', description: 'Code-focused Llama model' },
            { name: 'mistral', size: '4.1GB', description: 'Mistral 7B model' }
        ];
    }

    async getAllModels() {
        return Array.from(this.models.values());
    }

    async getModel(modelName) {
        return this.models.get(modelName);
    }

    async addModel(model) {
        this.models.set(model.name, {
            ...model,
            addedAt: new Date().toISOString()
        });
        console.log('Model added:', model.name);
    }

    async removeModel(modelName) {
        this.models.delete(modelName);
        console.log('Model removed:', modelName);
    }

    async getDefaultModels() {
        return this.defaultModels;
    }

    async isModelAvailable(modelName) {
        return this.models.has(modelName);
    }

    async getModelInfo(modelName) {
        const model = this.models.get(modelName);
        if (!model) {
            return null;
        }
        
        return {
            name: model.name,
            size: model.size,
            description: model.description,
            addedAt: model.addedAt,
            isAvailable: true
        };
    }
}

module.exports = new OllamaModelRepository();
