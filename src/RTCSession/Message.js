/**
 * @fileoverview DTMF
 */

/**
 * @class DTMF
 * @param {JsSIP.RTCSession} session
 */
(function(JsSIP) {

var Message;

Message = function(session) {
  var events = [
  'succeeded',
  'failed'
  ];

  this.session = session;
  this.direction = null;

  this.initEvents(events);
};
Message.prototype = new JsSIP.EventEmitter();


Message.prototype.send = function(text, options) {
  var request_sender, event, eventHandlers, extraHeaders;

  if (text === undefined) {
    throw new TypeError('Not enough arguments');
  }

  this.direction = 'outgoing';

  // Check RTCSession Status
  if (this.session.status !== JsSIP.RTCSession.C.STATUS_CONFIRMED && this.session.status !== JsSIP.RTCSession.C.STATUS_WAITING_FOR_ACK) {
    throw new JsSIP.Exceptions.InvalidStateError(this.session.status);
  }

  // Get DTMF options
  options = options || {};
  extraHeaders = options.extraHeaders ? options.extraHeaders.slice() : [];
  eventHandlers = options.eventHandlers || {};

  // Check tone type
  if (typeof text !== 'string' ) {
    throw new TypeError('Invalid data type');
  }

  // Set event handlers
  for (event in eventHandlers) {
    this.on(event, eventHandlers[event]);
  }

  extraHeaders.push('Content-Type: text/plain');

  this.request = this.session.dialog.createRequest(JsSIP.C.MESSAGE, extraHeaders);

  this.request.body = text+"\r\n";

  request_sender = new RequestSender(this);

  this.session.emit('newMessage', this.session, {
    originator: 'local',
    message: this,
    request: this.request
  });

  request_sender.send();
};

/**
 * @private
 */
Message.prototype.receiveResponse = function(response) {
  var cause;

  switch(true) {
    case /^1[0-9]{2}$/.test(response.status_code):
      // Ignore provisional responses.
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      this.emit('succeeded', this, {
        originator: 'remote',
        response: response
      });
      break;

    default:
      cause = JsSIP.Utils.sipErrorCause(response.status_code);
      this.emit('failed', this, {
        originator: 'remote',
        response: response,
        cause: cause
      });
      break;
  }
};

/**
 * @private
 */
Message.prototype.onRequestTimeout = function() {
  this.emit('failed', this, {
    originator: 'system',
    cause: JsSIP.C.causes.REQUEST_TIMEOUT
  });
};

/**
 * @private
 */
Message.prototype.onTransportError = function() {
  this.emit('failed', this, {
    originator: 'system',
    cause: JsSIP.C.causes.CONNECTION_ERROR
  });
};

/**
 * @private
 */
Message.prototype.init_incoming = function(request) {
  this.direction = 'incoming';
  this.request = request;

  request.reply(200);

  if (request.body) {
    this.session.emit('newMessage', this.session, {
      originator: 'remote',
      message: this,
      request: request
    });
  }
};

Message.C = C;
return Message;
}(JsSIP));
