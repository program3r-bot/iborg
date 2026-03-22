'use strict';

const express = require('express');
const authRouter = require('./auth');
const profilesRouter = require('./profiles');
const chatRouter = require('./chat');
const safetyRouter = require('./safety');

const router = express.Router();

router.use('/auth', authRouter);
router.use('/profiles', profilesRouter);
router.use('/chat', chatRouter);
router.use('/safety', safetyRouter);

module.exports = router;
