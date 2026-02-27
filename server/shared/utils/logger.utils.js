const morgan = require('morgan');
const rfs = require('rotating-file-stream');
const path = require('path');
const fs = require('fs');
const winston = require("winston");
require("winston-daily-rotate-file");

// Define log directory path
const logDirectory = path.resolve(__dirname, '../../log');

// Ensure log directory exists
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

// Create a rotating write stream for access logs (handled by morgan)
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',
    path: logDirectory
})

// Create a rotating transport for error logs (handled by winston)
const errorTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDirectory, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    level: "error",
});

// Create a rotating transport for combined logs (info and higher levels)
const combinedTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDirectory, "combined-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
});

// Create Winston logger with formatting and transports
const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}] ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        combinedTransport,
        errorTransport,
    ],
});

// Export morgan middlewares and the winston logger
module.exports = {
    dev: morgan('dev'),
    combined: morgan('combined', { stream: accessLogStream }),
    logger
}