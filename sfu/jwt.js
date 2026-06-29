'use strict';

const jwt = require('jsonwebtoken');

function verifySfuToken(token, { roomId, userId }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET_NOT_CONFIGURED');
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (payload.purpose !== 'sfu') throw new Error('INVALID_TOKEN_PURPOSE');
  if (payload.sub !== userId) throw new Error('TOKEN_USER_MISMATCH');
  if (payload.room_id !== roomId) throw new Error('TOKEN_ROOM_MISMATCH');
  return payload;
}

module.exports = { verifySfuToken };