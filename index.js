#!/usr/bin/env node
require('dotenv').config();
const io = require('socket.io-client');
const restify = require('restify-clients');
const MongoClient = require('mongodb').MongoClient;
const winston = require('winston');

const saltyIo = 'ws://www-cdn-twitch.saltybet.com:1337/';
const saltyApi = 'http://www.saltybet.com/';
const statePath = '/state.json';
const saltStateMineShaftUri = "mongodb://salty-visor:" + process.env.DB_PASS + "@salty-state-shaft-0-shard-00-00-yngvz.mongodb.net:27017,salty-state-shaft-0-shard-00-01-yngvz.mongodb.net:27017,salty-state-shaft-0-shard-00-02-yngvz.mongodb.net:27017/<DATABASE>?ssl=true&replicaSet=salty-state-shaft-0-shard-0&authSource=admin";

const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console),
        new (winston.transports.File)({filename: 'salt-miner.log'})

    ]
});

function closeDb(db) {
    db.close().then(function() {
        logger.info('MongoDB connection closed');
    }).catch(function(error) {
        logger.info('Error closing MongoDB connection', error);
    });
}

//Connect to the mine shaft
MongoClient.connect(saltStateMineShaftUri, null, function(err, db) {

    const socket = io(saltyIo);
    const client = restify.createJSONClient({
        url: saltyApi
    });
    console.log('connected');

    logger.info('Connected to MongoDB Instance');

    socket.on('connect_error', function(error) {
        logger.info('Unable to open socket to: ' + saltyIo, error);
        closeDb(db);
    });

    //Connect to the salty socket
    socket.on('connect', function() {
        var isPersisting = false;

        logger.info('Socket connected to: ' + saltyIo);

        const collection = db.collection('state');

        socket.on('message', function() {
            logger.info('Received message, requesting state from ' + saltyApi + statePath);
            client.get(statePath, function(err, req, res, state) {
                logger.info('Received state');
                if (!isPersisting && state && state.status && (state.status === "1" || state.status === "2")) {
                    isPersisting = true;
                    logger.info('DB - state persisting...', state);
                    collection.insertOne(state).then(function() {
                        logger.info('DB - state persisted successful');
                        isPersisting = false;
                    }).catch(function(error) {
                        logger.info('DB - Error persisting state', error);
                    });
                }
            });
        });

        socket.on('disconnect', function() {
            logger.info('Socket disconnected');
            closeDb(db);
        });
    });
});
