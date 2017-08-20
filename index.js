#!/usr/bin/env node
require('dotenv').config();
const io = require('socket.io-client');
const restify = require('restify-clients');
const MongoClient = require('mongodb').MongoClient;

const saltyIo = 'ws://www-cdn-twitch.saltybet.com:1337/';
const saltyApi = 'http://www.saltybet.com/';
const statePath = '/state.json';
const saltStateMineShaftUri = "mongodb://salty-visor:" + process.env.DB_PASS + "@salty-state-shaft-0-shard-00-00-yngvz.mongodb.net:27017,salty-state-shaft-0-shard-00-01-yngvz.mongodb.net:27017,salty-state-shaft-0-shard-00-02-yngvz.mongodb.net:27017/<DATABASE>?ssl=true&replicaSet=salty-state-shaft-0-shard-0&authSource=admin";


//Connect to the mine shaft
MongoClient.connect(saltStateMineShaftUri, null, function(err, db) {

    const socket = io(saltyIo);
    const client = restify.createJSONClient({
        url: saltyApi
    });
    console.log('connected');

    socket.on('connect_error', function(error) {
        console.log('Socket - error connecting ' + error.message);
        db.close();
    });

    //Connect to the salty socket
    socket.on('connect', function() {
        var isPersisting = false;

        const collection = db.collection('state');

        console.log('Socket - io connected');

        socket.on('message', function() {
            console.log('Socket - received message');
            client.get(statePath, function(err, req, res, obj) {
                console.log('Rest - Get received');
                if (!isPersisting && obj && obj.status && (obj.status === "1" || obj.status === "2")) {
                    isPersisting = true;
                    console.log('DB - persisting...');
                    collection.insertOne(obj).then(function() {
                        console.log('DB - persisted');
                        isPersisting = false;
                    });
                }
            });
        });

        socket.on('disconnect', function() {
            console.log('Socket - io disconnected');
            db.close();
        });
    });

});
