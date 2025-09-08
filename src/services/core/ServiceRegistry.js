/**
 * Service Registry
 * Manages all services in the application with dependency resolution,
 * lifecycle management, and health monitoring
 */
class ServiceRegistry {
    constructor() {
        this.services = new Map();
        this.initializationOrder = [];
        this.shutdownOrder = [];
        this.isShuttingDown = false;
    }
    
    /**
     * Register a service
     * @param {string} name - Service name
     * @param {BaseService} service - Service instance
     * @param {Object} options - Registration options
     */
    register(name, service, options = {}) {
        if (this.services.has(name)) {
            throw new Error(`Service already registered: ${name}`);
        }
        
        this.services.set(name, {
            service,
            dependencies: options.dependencies || [],
            isCritical: options.isCritical || false,
            initPriority: options.initPriority || 100,
            metadata: options.metadata || {}
        });
        
        console.log(`[ServiceRegistry] Registered service: ${name}`);
    }
    
    /**
     * Get a service by name
     * @param {string} name - Service name
     * @returns {BaseService}
     */
    get(name) {
        const entry = this.services.get(name);
        return entry ? entry.service : null;
    }
    
    /**
     * Get all services
     * @returns {Map}
     */
    getAll() {
        return new Map(
            Array.from(this.services.entries()).map(([name, entry]) => [name, entry.service])
        );
    }
    
    /**
     * Check if a service is registered
     * @param {string} name - Service name
     * @returns {boolean}
     */
    has(name) {
        return this.services.has(name);
    }
    
    /**
     * Initialize all services in dependency order
     * @returns {Promise<void>}
     */
    async initializeAll() {
        console.log('[ServiceRegistry] Initializing all services...');
        
        try {
            // Resolve initialization order based on dependencies
            this.initializationOrder = this.resolveInitializationOrder();
            console.log('[ServiceRegistry] Initialization order:', this.initializationOrder);
            
            // Initialize services in order
            for (const name of this.initializationOrder) {
                const entry = this.services.get(name);
                
                try {
                    console.log(`[ServiceRegistry] Initializing ${name}...`);
                    
                    // Inject dependencies
                    if (entry.dependencies.length > 0) {
                        const deps = this.resolveDependencies(name);
                        if (entry.service.setDependencies) {
                            entry.service.setDependencies(deps);
                        }
                    }
                    
                    await entry.service.initialize();
                    
                    // Auto-start if configured
                    if (entry.metadata.autoStart) {
                        await entry.service.start();
                    }
                    
                } catch (error) {
                    console.error(`[ServiceRegistry] Failed to initialize ${name}:`, error);
                    
                    if (entry.isCritical) {
                        throw new Error(`Critical service failed: ${name} - ${error.message}`);
                    } else {
                        console.warn(`[ServiceRegistry] Continuing without ${name}`);
                    }
                }
            }
            
            // Set shutdown order (reverse of initialization)
            this.shutdownOrder = [...this.initializationOrder].reverse();
            
            console.log('[ServiceRegistry] All services initialized');
            
        } catch (error) {
            console.error('[ServiceRegistry] Initialization failed:', error);
            await this.shutdownAll();
            throw error;
        }
    }
    
    /**
     * Start all services
     * @returns {Promise<void>}
     */
    async startAll() {
        console.log('[ServiceRegistry] Starting all services...');
        
        for (const name of this.initializationOrder) {
            const entry = this.services.get(name);
            
            try {
                if (entry.service.state === 'initialized') {
                    await entry.service.start();
                }
            } catch (error) {
                console.error(`[ServiceRegistry] Failed to start ${name}:`, error);
                
                if (entry.isCritical) {
                    throw error;
                }
            }
        }
        
        console.log('[ServiceRegistry] All services started');
    }
    
    /**
     * Stop all services
     * @returns {Promise<void>}
     */
    async stopAll() {
        console.log('[ServiceRegistry] Stopping all services...');
        
        for (const name of this.shutdownOrder) {
            const entry = this.services.get(name);
            
            try {
                if (entry.service.state === 'active') {
                    await entry.service.stop();
                }
            } catch (error) {
                console.error(`[ServiceRegistry] Failed to stop ${name}:`, error);
                // Continue stopping other services
            }
        }
        
        console.log('[ServiceRegistry] All services stopped');
    }
    
    /**
     * Shutdown all services with cleanup
     * @param {number} timeout - Maximum time to wait for graceful shutdown
     * @returns {Promise<void>}
     */
    async shutdownAll(timeout = 10000) {
        if (this.isShuttingDown) {
            console.log('[ServiceRegistry] Shutdown already in progress');
            return;
        }
        
        this.isShuttingDown = true;
        console.log('[ServiceRegistry] Shutting down all services...');
        
        const shutdownPromises = [];
        
        for (const name of this.shutdownOrder) {
            const entry = this.services.get(name);
            
            if (entry && entry.service) {
                shutdownPromises.push(
                    entry.service.gracefulShutdown(timeout)
                        .catch(error => {
                            console.error(`[ServiceRegistry] Error shutting down ${name}:`, error);
                        })
                );
            }
        }
        
        // Wait for all services to shutdown with timeout
        await Promise.race([
            Promise.all(shutdownPromises),
            new Promise(resolve => setTimeout(resolve, timeout + 1000))
        ]);
        
        console.log('[ServiceRegistry] All services shut down');
        this.isShuttingDown = false;
    }
    
    /**
     * Resolve initialization order based on dependencies
     * @returns {Array<string>}
     */
    resolveInitializationOrder() {
        const order = [];
        const visited = new Set();
        const visiting = new Set();
        
        const visit = (name) => {
            if (visited.has(name)) return;
            if (visiting.has(name)) {
                throw new Error(`Circular dependency detected: ${name}`);
            }
            
            visiting.add(name);
            
            const entry = this.services.get(name);
            if (entry) {
                // Visit dependencies first
                for (const depName of entry.dependencies) {
                    if (this.services.has(depName)) {
                        visit(depName);
                    } else {
                        console.warn(`[ServiceRegistry] Missing dependency: ${depName} for ${name}`);
                    }
                }
            }
            
            visiting.delete(name);
            visited.add(name);
            order.push(name);
        };
        
        // Sort services by priority first
        const sortedServices = Array.from(this.services.entries())
            .sort((a, b) => a[1].initPriority - b[1].initPriority);
        
        // Visit each service
        for (const [name] of sortedServices) {
            visit(name);
        }
        
        return order;
    }
    
    /**
     * Resolve dependencies for a service
     * @param {string} name - Service name
     * @returns {Object}
     */
    resolveDependencies(name) {
        const entry = this.services.get(name);
        if (!entry) return {};
        
        const deps = {};
        
        for (const depName of entry.dependencies) {
            const depEntry = this.services.get(depName);
            if (depEntry) {
                deps[depName] = depEntry.service;
            } else {
                console.warn(`[ServiceRegistry] Missing dependency: ${depName} for ${name}`);
            }
        }
        
        return deps;
    }
    
    /**
     * Get health status of all services
     * @returns {Object}
     */
    getHealthStatus() {
        const status = {
            healthy: true,
            services: {},
            summary: {
                total: this.services.size,
                active: 0,
                failed: 0,
                stopped: 0
            }
        };
        
        for (const [name, entry] of this.services.entries()) {
            const serviceStatus = entry.service.getStatus();
            status.services[name] = serviceStatus;
            
            if (serviceStatus.state === 'active') {
                status.summary.active++;
            } else if (serviceStatus.state === 'failed') {
                status.summary.failed++;
                if (entry.isCritical) {
                    status.healthy = false;
                }
            } else if (serviceStatus.state === 'stopped') {
                status.summary.stopped++;
            }
        }
        
        return status;
    }
    
    /**
     * Restart a service
     * @param {string} name - Service name
     * @returns {Promise<void>}
     */
    async restartService(name) {
        const entry = this.services.get(name);
        if (!entry) {
            throw new Error(`Service not found: ${name}`);
        }
        
        console.log(`[ServiceRegistry] Restarting service: ${name}`);
        
        try {
            // Stop if active
            if (entry.service.state === 'active') {
                await entry.service.stop();
            }
            
            // Re-initialize
            await entry.service.initialize();
            
            // Start if it was active
            if (entry.metadata.autoStart) {
                await entry.service.start();
            }
            
            console.log(`[ServiceRegistry] Service restarted: ${name}`);
        } catch (error) {
            console.error(`[ServiceRegistry] Failed to restart ${name}:`, error);
            throw error;
        }
    }
    
    /**
     * Get service dependency graph
     * @returns {Object}
     */
    getDependencyGraph() {
        const graph = {};
        
        for (const [name, entry] of this.services.entries()) {
            graph[name] = {
                dependencies: entry.dependencies,
                dependents: []
            };
        }
        
        // Find dependents
        for (const [name, entry] of this.services.entries()) {
            for (const dep of entry.dependencies) {
                if (graph[dep]) {
                    graph[dep].dependents.push(name);
                }
            }
        }
        
        return graph;
    }
}

// Singleton instance
const serviceRegistry = new ServiceRegistry();

module.exports = serviceRegistry;