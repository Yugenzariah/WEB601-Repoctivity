// Section - Import core modules and middleware
const express = require('express');
const axios = require('axios');
const winston = require('winston');
const cors = require('cors');
const CircuitBreaker = require('opossum');


// Install express app
const app = express();
app.use(cors()); // Use cross origin for all routes
app.use(express.json()); // Parse incoming JSON payloads

// Config target service endpoints via .env variables
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

// Init structured logger with timestamps
const logger = winston.createLogger({
    level: 'info',
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.json()
    )
});

// Circuit breaker factory to wrap HTTP calls
function createBreaker() {
    return new CircuitBreaker(
        options => axios(options),
        {
            timeout: 5000, // Execution functionality: performs HTTP req
            errorThresholdPercentage: 50, // Time in ms before a req is considered a fail, % of failures trip the breaker
            resetTimeout: 10000 // Time before resetting the breaker
        }
    )
}

const userBreaker = createBreaker(); // Resilient client for User Service
const productBreaker = createBreaker(); // Resilient client for the Product Service

// Universal proxy function: forwards req and handlers res /errors

async function proxyRequest(serviceUrl, breaker, req, res) {
    try {
        const targetUrl = serviceUrl + req.originalUrl.replace('/api', '')
        const response = await breaker.fire({
            method: req.method,
            url: targetUrl,
            data: req.body,
            header: { Accept: 'application/json' }
        })
        res.status (response.status).set(response.headers).send(response.data)

    } catch(err) {
        logger.error(`Proxy error: ${err.message}`)
        const status = err.response ? error.response.status: 502
        res.status(status).json({ error: message })
    }
    
}

// Method dispatch for user service
app.options('api/users/*', (req, res) => res.sendStatus(200))
app.head('api/users/*', (req, res) => proxyRequest(USER_SERVICE_URL, userBreaker, req, res));
app.all('api/users/*', (req, res) => proxyRequest(USER_SERVICE_URL, userBreaker, req, res));