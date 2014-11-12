// langid.js is a direct port of langid.py to JavaScript.
// For license conditions, see the LICENSE file in the same repository.
// Marco Lui <saffsd@gmail.com>, July 2014

"use strict";
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['exports', 'atob', './langid-model-full'], factory);
    } else if (typeof exports === 'object') {
        // CommonJS
        factory(exports, require('atob'), require('./langid-model-full'));
    } else {
        // Browser globals
        factory((root.commonJsStrict = {}), root.atob, {_tk_nextmove: root._tk_nextmove, _tk_output: root._tk_output, _nb_pc: root._nb_pc, _nb_ptc: root._nb_ptc, _nb_classes: root._nb_classes});
    }
}(this, function (exports, atob, langid_model) {
    //use b in some fashion.

    // attach properties to the exports object to define
    // the exported module properties.
	
	var _tk_nextmove = langid_model._tk_nextmove;
	var _tk_output = langid_model._tk_output;
	var _nb_pc = langid_model._nb_pc;
	var _nb_ptc = langid_model._nb_ptc;
	var _nb_classes = langid_model._nb_classes;

	(function() {

	  function base64ToArray(encStr, arraytype) {
		var decStr = atob(encStr)
		var buf = new ArrayBuffer(decStr.length);
		var bufWrite = new Uint8Array(buf);
		for (var i=0, bufSize=bufWrite.length; i<bufSize; i++){
		  bufWrite[i] = decStr.charCodeAt(i);
		}
		var bufView = new arraytype(buf);
		return bufView;
	  }

	  // unpack the model. the _xxx packed version is externally supplied.
	  var tk_nextmove = base64ToArray(_tk_nextmove, Uint16Array);
	  var tk_output_packed = base64ToArray(_tk_output, Uint16Array);
	  var nb_pc = base64ToArray(_nb_pc, Float64Array);
	  var nb_ptc = base64ToArray(_nb_ptc, Float64Array);
	  var nb_classes = _nb_classes

	  // unpack tk_output
	  var tk_output = {};
	  var limit = tk_output_packed[0];
	  for (var i=0, j=1; i < limit; i++) {
		var s = tk_output_packed[j];
		var c = tk_output_packed[j+1];
		var arr = tk_output_packed.subarray(j+2,j+2+c);

		tk_output[s] = arr;
		j += 2+c;
	  }

	  // calculate some properties of the model
	  var num_langs = nb_classes.length;
	  var num_features = nb_ptc.length / num_langs;
	  var num_states = tk_nextmove.length / 256;

	  console.log("unpacked a langid model: " + num_langs + " langs, " + num_features + " feats, " + num_states + " states.");

	  exports.textToFv = function(str){
		// convert raw input text to a vector of transitions.

		// The model in langid.js operates at a byte level, and most
		// of the training data used was UTF8, so we need to first encode 
		// the string in UTF8 before processing.
		var enc = unescape(encodeURIComponent(str));

		var sv = new Uint32Array(num_states);
		var s = 0; // start at state 0;
		for (var i=0, l=enc.length; i<l; i++){
		  var c = enc.charCodeAt(i);
		  s = tk_nextmove[(s<<8)+c];
		  sv[s] += 1;
		}

		// convert the transitions into feature counts
		var fv = new Uint32Array(num_features);
		for (var i=0, l=num_states; i<l; i++){
		  if ((sv[i] > 0) && (i in tk_output)){
			var states = tk_output[i];
			for (var j=0, m=states.length; j<m; j++){
			  fv[states[j]] += sv[i]; // increment corresponding features 
			}
		  }
		}

		return fv;
	  }

	  exports.fvToLogprob = function(fv){
		// rank languages based on an input fv
		var logprob = new Float64Array(nb_pc);
		for (var i = 0; i < num_features; i++){
		  if (fv[i] > 0){
			for (var j=0; j < num_langs; j++){
			  logprob[j] += fv[i] * nb_ptc[i*num_langs + j];
			}
		  }
		}
		return logprob;
	  }

	  exports.logprobToPred = function(logprob){
		var _i = 0;

		for (var i=1;i<num_langs;i++){
		  if (logprob[_i] < logprob[i]) _i = i;
		}
		console.log('pred: '+_i+ ' lang: '+ nb_classes[_i] + ' logprob: ' + logprob[_i]);
		return nb_classes[_i];
	  }

	  exports.logprobToRank= function(logprob){
		var preds = [];
		for (var i=0;i<num_langs;i++) preds.push({"lang":nb_classes[i], "logprob":logprob[i]});
		preds.sort(function(a,b){return b["logprob"]-a["logprob"];});

		return preds;
	  }

	  exports.identify = function(str){
		var fv = exports.textToFv(str);
		var lp = exports.fvToLogprob(fv);
		var pred = exports.logprobToPred(lp);
		return pred;
	  }

	  exports.rank = function(str){
		var fv = exports.textToFv(str);
		var lp = exports.fvToLogprob(fv);
		var rank = exports.logprobToRank(lp);
		return rank;
	  }
	})();
}));