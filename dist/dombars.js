!function(e){"object"==typeof exports?module.exports=e():"function"==typeof define&&define.amd?define(e):"undefined"!=typeof window?window.DOMBars=e():"undefined"!=typeof global?global.DOMBars=e():"undefined"!=typeof self&&(self.DOMBars=e())}(function(){var define,module,exports;
return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var base     = require('./dombars/base');
var compiler = require('./dombars/compiler');
var utils    = require('./dombars/utils');
var runtime  = require('./dombars/runtime');

/**
 * Generate the base DOMBars object.
 *
 * @return {Object}
 */
module.exports = (function create () {
  var db = base.create();

  utils.attach(db);
  compiler.attach(db);
  runtime.attach(db);

  db.create = create;

  return db;
})();

},{"./dombars/base":2,"./dombars/compiler":9,"./dombars/runtime":13,"./dombars/utils":14}],2:[function(require,module,exports){
var base = require('handlebars/lib/handlebars/base');

exports.create = function () {
  var DOMBars = base.create.apply(this, arguments);

  /**
   * Noop functions for subscribe and unsubscribe. Implement your own function.
   */
  DOMBars.subscribe  = DOMBars.unsubscribe = function () {};
  DOMBars.Handlebars = require('handlebars');

  /**
   * Basic getter function. Attach this however you want it to work.
   *
   * @param  {Object} object
   * @param  {String} property
   * @return {*}
   */
  DOMBars.get = function (object, property) {
    return object[property];
  };

  /**
   * Handlebars `each` helper is incompatibable with DOMBars, since it assumes
   * strings (as opposed to document fragments).
   *
   * @param  {Object} context
   * @param  {Object} options
   * @return {Node}
   */
  DOMBars.registerHelper('each', function (context, options) {
    var fn      = options.fn;
    var inverse = options.fn;
    var buffer  = document.createDocumentFragment();
    var i       = 0;
    var data;

    if (typeof context === 'function') {
      context = context.call(this);
    }

    if (options.data) {
      data = DOMBars.createFrame(options.data);
    }

    if (typeof context === 'object') {
      var len = context.length;

      if (len === +len) {
        for (; i < len; i++) {
          if (data) { data.index = i; }
          buffer.appendChild(fn(context[i], { data: data }));
        }
      } else {
        for (var key in context) {
          if (context.hasOwnProperty(key)) {
            i += 1;
            if (data) { data.key = key; }
            buffer.appendChild(fn(context[key], { data: data }));
          }
        }
      }
    }

    if (i === 0) {
      return inverse(this);
    }

    return buffer;
  });

  return DOMBars;
};


},{"handlebars":20,"handlebars/lib/handlebars/base":21}],3:[function(require,module,exports){
var ast = require('handlebars/lib/handlebars/compiler/ast');

/**
 * Attach the AST object representations to the DOMBars instance.
 *
 * @param  {Object} DOMBars
 * @return {Object}
 */
exports.attach = function (DOMBars) {
  ast.attach(DOMBars);

  DOMBars.AST.DOM = {
    Element: function (name, attributes, content) {
      this.type       = 'DOM_ELEMENT';
      this.name       = name;
      this.attributes = attributes;
      this.content    = content;
    },
    Attribute: function (name, value) {
      this.type  = 'DOM_ATTRIBUTE';
      this.name  = name;
      this.value = value;
    },
    Comment: function (text) {
      this.type = 'DOM_COMMENT';
      this.text = text;
    },
    Text: function (text) {
      this.type = 'DOM_TEXT';
      this.text = text;
    }
  };

  return DOMBars;
};

},{"handlebars/lib/handlebars/compiler/ast":22}],4:[function(require,module,exports){
var base = require('handlebars/lib/handlebars/compiler/base');

/**
 * Attach the base compiler functionality to the DOMBars object.
 *
 * @param  {Object} DOMBars
 * @return {Object}
 */
exports.attach = function (DOMBars) {
  base.attach(DOMBars);

  DOMBars.Parser = require('./parser');
  DOMBars.Parser.yy = DOMBars.AST;

  DOMBars.Compiler           = require('./compilers/base');
  DOMBars.JavaScriptCompiler = require('./compilers/javascript');

  /**
   * Check the arguments passed into the compilation functions before trying to
   * compile the as a program.
   *
   * @param  {Function} fn
   * @return {Function}
   */
  var compilePrecheck = function (fn) {
    return function (input, options) {
      if (typeof input !== 'string') {
        if (!(input instanceof DOMBars.AST.ProgramNode)) {
          throw new DOMBars.Exception(
            'You must pass a string or DOMBars AST to DOMBars.precompile. ' +
            'You passed ' + input
          );
        }
      }

      options = options || {};

      if (!('data' in options)) {
        options.data = true;
      }

      return fn(input, options);
    };
  };

  /**
   * Precompile generates a string-based JavaScript function.
   *
   * @param  {String} input
   * @param  {Object} options
   * @return {String}
   */
  DOMBars.precompile = compilePrecheck(function (input, options) {
    var ast         = DOMBars.parse(input);
    var environment = new DOMBars.Compiler().compile(ast, options);
    return new DOMBars.JavaScriptCompiler().compile(environment, options);
  });

  /**
   * Compilation return a function that is immediately ready for execution as a
   * template.
   *
   * @param  {String}   input
   * @param  {Object}   options
   * @return {Function}
   */
  DOMBars.compile = compilePrecheck(function (input, options) {
    var compiled;

    var compile = function () {
      var ast          = DOMBars.parse(input);
      var environment  = new DOMBars.Compiler().compile(ast, options);
      var templateSpec = new DOMBars.JavaScriptCompiler().compile(
        environment, options, undefined, true
      );

      return DOMBars.template(templateSpec);
    };

    return function (context, options) {
      if (!compiled) {
        compiled = compile();
      }

      return compiled.call(this, context, options);
    };
  });

  return DOMBars;
};

},{"./compilers/base":6,"./compilers/javascript":8,"./parser":10,"handlebars/lib/handlebars/compiler/base":23}],5:[function(require,module,exports){
var Handlebars     = require('handlebars');
var CommonCompiler = require('./common').prototype;

/**
 * Attribute compiler.
 */
var Compiler = module.exports = function () {};
Compiler.prototype = Handlebars.createFrame(CommonCompiler);
Compiler.prototype.compiler = Compiler;
/**
 * Append content to the current buffer.
 */
Compiler.prototype.append = function () {
  this.subscribe();
  CommonCompiler.append.call(this);
};

/**
 * Append escaped Handlebars content to the source.
 */
Compiler.prototype.appendEscaped = function () {
  this.subscribe();
  CommonCompiler.appendEscaped.call(this);
};


},{"./common":7,"handlebars":20}],6:[function(require,module,exports){
var Handlebars = require('handlebars');
var JSCompiler = Handlebars.Compiler.prototype;

/**
 * Base compiler in charge of generating a consumable environment for the
 * JavaScript compiler.
 */
var Compiler = module.exports = function () {};
Compiler.prototype = Handlebars.createFrame(JSCompiler);
Compiler.prototype.compiler = Compiler;

/**
 * Append a DOM element node to the environment.
 *
 * @param {Object} node
 */
Compiler.prototype.DOM_ELEMENT = function (node) {
  this.opcode('pushProgram', this.compileAttribute(node.name));
  this.opcode('invokeElement');

  var name, value;
  for (var i = 0, len = node.attributes.length; i < len; i++) {
    name  = this.compileAttribute(node.attributes[i].name);
    value = this.compileAttribute(node.attributes[i].value);
    this.appendAttribute(name, value);
  }

  this.opcode('pushProgram', this.compileProgram(node.content));
  this.opcode('invokeContent');
  this.opcode('appendElement');
};

/**
 * Append a DOM comment node to the environment.
 *
 * @param {Object} node
 */
Compiler.prototype.DOM_COMMENT = function (node) {
  this.opcode('pushProgram', this.compileAttribute(node.text));
  this.opcode('invokeComment');
  this.opcode('appendElement');
};

/**
 * Append a DOM text node to the environment.
 *
 * @param {Object} node
 */
Compiler.prototype.DOM_TEXT = function (node) {
  this.opcode('pushProgram', this.compileProgram(node.text));
  this.opcode('appendProgram');
};

/**
 * Append an attribute to the environment.
 *
 * @param  {Object} name
 * @param  {Object} value
 */
Compiler.prototype.appendAttribute = function (name, value) {
  this.opcode('pushProgram', name);
  this.opcode('pushProgram', value);
  this.opcode('invokeAttribute');
};

/**
 * Compile an attribute program.
 *
 * @param  {Object} program
 * @return {Number}
 */
Compiler.prototype.compileAttribute = function (program) {
  var guid = JSCompiler.compileProgram.call(this, program);
  this.children[guid].attribute = true;
  return guid;
};

/**
 * Resolve the basic mustache node.
 *
 * @param {Object} mustache
 */
Compiler.prototype.simpleMustache = function (mustache) {
  var id = mustache.id;

  if (id.type === 'DATA') {
    this.DATA(id);
  } else if (id.parts.length) {
    this.ID(id);
  } else {
    // Simplified ID for `this`.
    this.addDepth(id.depth);
    this.opcode('getContext', id.depth);
    this.opcode('pushContext');
    this.opcode('lookupSelf');
  }

  this.opcode('resolvePossibleLambda');
};

},{"handlebars":20}],7:[function(require,module,exports){
var Handlebars = require('handlebars');
var JSCompiler = Handlebars.JavaScriptCompiler.prototype;

/**
 * Create the base compiler functionality and attach relevant references.
 */
var Compiler = module.exports = function () {};
Compiler.prototype = Handlebars.createFrame(JSCompiler);
Compiler.prototype.compiler = Compiler;

/**
 * Override name lookup to use the function provided on the DOMBars object.
 *
 * @return {String}
 */
Compiler.prototype.nameLookup = function (parent, name, type) {
  var quotedName = this.quotedString(name);
  var quotedType = this.quotedString(type);
  this.context.aliases.get = 'this.get';

  return 'get(' + parent + ', ' + quotedName + ', ' + quotedType + ')';
};

/**
 * Subscribe to the last subscription on the context stack.
 *
 * @param  {Function} fn
 * @return {String}
 */
Compiler.prototype.subscribe = function (fn, count) {
  var programName = this.quotedString(this.name);

  count = count || 1;

  this.context.aliases.subscribe = 'this.subscribe';

  this.register('cb', fn ? 'function (value) {' + fn('value') + '}' : 'null');

  while (count--) {
    this.source.push('subscribe(' + programName + ', cb);');
  }
};

/**
 * Simple function for looking up references on itself only.
 */
Compiler.prototype.lookupSelf = function () {
  this.replaceStack(function(current) {
    return 'get(' + current + ', null, "self")';
  });
};

},{"handlebars":20}],8:[function(require,module,exports){
var Handlebars = require('handlebars');
var CommonCompiler = require('./common').prototype;

/**
 * Extends Handlebars JavaScript compiler to add DOM specific rules.
 */
var Compiler = module.exports = function () {};
Compiler.prototype = Handlebars.createFrame(CommonCompiler);
Compiler.prototype.compiler    = Compiler;
Compiler.prototype.attrCompiler = require('./attributes');

/**
 * Compiles the environment object generated by the base compiler.
 *
 * @param  {Object}            environment
 * @return {(Function|String)}
 */
Compiler.prototype.compile = function () {
  this.elementSlot       = 0;
  this.subscriptionStack = [];

  return CommonCompiler.compile.apply(this, arguments);
};

/**
 * Compile any child program nodes. E.g. Block helpers.
 *
 * @param {Object} environment
 * @param {Object} options
 */
Compiler.prototype.compileChildren = function(environment, options) {
  var children = environment.children;
  var child, Compiler, program, index;

  for (var i = 0, l = children.length; i < l; i++) {
    child    = children[i];
    index    = this.matchExistingProgram(child);
    Compiler = this.compiler;

    if (child.attribute) {
      Compiler = this.attrCompiler;
    }

    if (index == null) {
      this.context.programs.push('');
      child.index = index = this.context.programs.length;
      child.name  = 'program' + index;
      program = new Compiler().compile(child, options, this.context);
      this.context.programs[index]     = program;
      this.context.environments[index] = child;
    } else {
      child.index = index;
      child.name  = 'program' + index;
    }
  }
};

/**
 * Push an element onto the stack and return it.
 *
 * @return {String}
 */
Compiler.prototype.pushElement = function () {
  return 'element' + (++this.elementSlot);
};

/**
 * Pop the last element off the stack and return it.
 *
 * @return {String}
 */
Compiler.prototype.popElement = function () {
  return 'element' + (this.elementSlot--);
};

/**
 * Returns the element at the end of the stack.
 *
 * @return {String}
 */
Compiler.prototype.topElement = function () {
  return 'element' + this.elementSlot;
};

/**
 * Append some content to the buffer (a document fragment).
 *
 * @param  {String} string
 * @return {String}
 */
Compiler.prototype.appendToBuffer = function (string) {
  if (this.environment.isSimple) {
    return 'return ' + string + ';';
  }

  this.context.aliases.append = 'this.appendChild';

  return 'append(buffer,' + string + ');';
};

/**
 * Initialize the base value of the buffer, in this case a document fragment.
 *
 * @return {String}
 */
Compiler.prototype.initializeBuffer = function () {
  return 'document.createDocumentFragment()';
};

/**
 * Merges the source into a stringified output.
 *
 * @return {String}
 */
Compiler.prototype.mergeSource = function () {
  return this.source.join('\n  ');
};

/**
 * Append a variable to the stack. Adds some additional logic to transform the
 * text into a DOM node before we attempt to append it to the buffer.
 */
Compiler.prototype.append = function () {
  this.flushInline();
  var local = this.popStack();

  this.context.aliases.domify = 'this.domifyExpression';

  this.source.push('if (' + local + ' || ' + local + ' === 0) {');
  this.source.push('  ' + this.appendToBuffer('domify(' + local + ')'));
  this.source.push('}');

  if (this.environment.isSimple) {
    this.source.push('else { return ' + this.initializeBuffer() + '; }');
  }
};

/**
 * Append a text node to the buffer.
 *
 * @param {String} content
 */
Compiler.prototype.appendContent = function (content) {
  var string = 'document.createTextNode(' + this.quotedString(content) + ')';
  this.source.push(this.appendToBuffer(string));
};

/**
 * Append a program node to the source.
 */
Compiler.prototype.appendProgram = function () {
  this.source.push(this.appendToBuffer(
    this.popStack() + '(depth' + this.lastContext + ')'
  ));
};

/**
 * Append an escaped Handlebars expression to the source.
 */
Compiler.prototype.appendEscaped = function () {
  this.context.aliases.textify     = 'this.textifyExpression';
  this.context.aliases.replaceNode = 'this.replaceNode';

  this.pushStack('textify(' + this.popStack() + ')');

  var stack = this.topStack();
  this.subscribe(function (value) {
    return 'replaceNode(textify(' + value +  '), ' + stack + ');';
  });

  this.source.push(this.appendToBuffer(stack));
};

/**
 * Append an element node to the source.
 */
Compiler.prototype.appendElement = function () {
  this.source.push(this.appendToBuffer(this.popStack()));
};

/**
 * Create a DOM comment node ready for appending to the current buffer.
 */
Compiler.prototype.invokeComment = function () {
  this.replaceStack(function (current) {
    var depth = 'depth' + this.lastContext;
    return 'document.createComment(' + current + '(' + depth + '))';
  });
};

/**
 * Create a DOM element node ready for appending to the current buffer.
 */
Compiler.prototype.invokeElement = function () {
  var element     = this.pushElement();
  var current     = this.popStack();
  var depth       = 'depth' + this.lastContext;
  var execProgram = 'program(' + depth + ')';

  this.useRegister(element);

  this.context.aliases.self        = 'this';
  this.context.aliases.append      = 'this.appendChild';
  this.context.aliases.createEl    = 'this.createElement';
  this.context.aliases.setAttr     = 'this.setAttribute';
  this.context.aliases.replaceNode = 'this.replaceNode';

  this.source.push('(function (program) {');

  this.source.push(element + ' = createEl(' + execProgram + ');');

  this.source.push(
    'self.on("change program" + program.program, function () {' +
      'var newEl = createEl(' + execProgram + ');' +
      'while (' + element + '.childNodes.length) {' +
        'append(newEl, ' + element + '.childNodes[0]);' +
      '}' +
      'for (i = 0; i < ' + element + '.attributes.length; i++) {' +
        'var attr = ' + element + '.attributes[i];' +
        'setAttr(newEl, attr.name, attr.value);' +
      '}' +
      element + ' = replaceNode(newEl, ' + element + ');' +
    '});'
  );

  this.source.push('})(' + current + ');');

  this.push(element);
};

/**
 * Append an attribute node to the current element.
 */
Compiler.prototype.invokeAttribute = function () {
  var depth   = 'depth' + this.lastContext;
  var element = this.topElement();
  var value   = this.popStack();
  var name    = this.popStack();

  this.context.aliases.self       = 'this';
  this.context.aliases.setAttr    = 'this.setAttribute';
  this.context.aliases.removeAttr = 'this.removeAttribute';

  var execName  = 'nameProgram(' + depth + ')';
  var execValue = 'valueProgram(' + depth + ')';

  this.source.push('(function (nameProgram, valueProgram) {');

  this.source.push('var name  = ' + execName);
  this.source.push('var value = ' + execValue);

  this.source.push('setAttr(' + element + ', name, value);');

  this.source.push(
    'self.on("change program" + nameProgram.program, function () {' +
      'removeAttr(' + element + ', name);' +
      'setAttr(' + element + ', name = ' + execName + ', value);' +
    '});'
  );

  this.source.push(
    'self.on("change program" + valueProgram.program, function () {' +
      'setAttr(' + element + ', name, value = ' + execValue + ');' +
    '});'
  );

  this.source.push('})(' + name + ',' + value + ');');
};

/**
 * Invoke an arbitrary program and append to the current element.
 */
Compiler.prototype.invokeContent = function () {
  var element = this.topElement();
  var depth   = 'depth' + this.lastContext;

  this.context.aliases.append = 'this.appendChild';

  this.register('child', this.popStack() + '(' + depth + ')');

  // Check that we have a child node before we attempt to append to the DOM.
  this.source.push(
    'if (child != null) { append(' + element + ',child); }'
  );
};

},{"./attributes":5,"./common":7,"handlebars":20}],9:[function(require,module,exports){
var ast     = require('./ast');
var base    = require('./base');
var printer = require('./printer');
var visitor = require('./visitor');

exports.attach = function (DOMBars) {
  visitor.attach(DOMBars);
  printer.attach(DOMBars);
  ast.attach(DOMBars);
  base.attach(DOMBars);

  return DOMBars;
};

},{"./ast":3,"./base":4,"./printer":11,"./visitor":12}],10:[function(require,module,exports){
var HbsParser  = require('handlebars/lib/handlebars/compiler/parser');
var HTMLParser = require('htmlparser2/lib/Parser');

/**
 * Stringify an `AST.ProgramNode` so it can be run through others parsers. This
 * is required for the node to be parsed as HTML *after* it is parsed as a
 * Handlebars template. Handlebars must always run before the HTML parser, so
 * it can correctly match block nodes (I couldn't see a simple way to resume
 * the end block node parsing).
 *
 * @param  {Handlebars.AST.ProgramNode} program
 * @return {String}
 */
var stringifyProgram = function (program) {
  var html       = '';
  var statements = program.statements;

  for (var i = 0; i < statements.length; i++) {
    var statement = statements[i];

    if (statement.type === 'content') {
      html += statement.string;
    } else {
      html += '{{d' + i + '}}'; // "Alias" node
    }
  }

  return html;
};

/**
 * Parses a text string returned from stringifying a program node. Replaces any
 * mustache node references with the original node.

 * @param  {String} input
 * @param  {Object} originalProgram
 * @return {Object}
 */
var parseProgram = function (input, originalProgram) {
  var program    = HbsParser.parse(input);
  var statements = program.statements;

  for (var i = 0; i < statements.length; i++) {
    var statement = statements[i];

    // Replace mustache nodes, which *should* only be real Handlebars "alias"
    // nodes that were injected by the stringification of the program node.
    if (statement.type === 'mustache') {
      statements[i] = originalProgram.statements[statement.id.string.substr(1)];
      statement = statements[i];
    }

    // Need to recursively resolve block node programs as HTML.
    if (statement.type === 'block') {
      if (statement.program) {
        statement.program = parseAsHTML(statement.program);
      }

      if (statement.inverse) {
        statement.inverse = parseAsHTML(statement.inverse);
      }
    }
  }

  return program;
};

/**
 * Parse a program object as HTML and return an updated program.
 *
 * @param  {Object} originalProgram
 * @return {Object}
 */
var parseAsHTML = function (originalProgram) {
  var yy   = HbsParser.yy;
  var html = stringifyProgram(originalProgram);

  // Create and return a new empty program node.
  var newProgram = function () {
    return new yy.ProgramNode([]);
  };

  // Start the stack with an empty program node which will contain all the
  // parsed elements.
  var program = newProgram();
  var stack   = [program];
  var element;

  // Generate a new HTML parser instance.
  var parser = new HTMLParser({
    onopentagname: function (name) {
      var node = new yy.DOM.Element(name, [], newProgram());
      program.statements.push(node);

      // Alias the currently active program node and element.
      element = node;
      stack.push(program = node.content);
    },
    onclosetag: function () {
      stack.pop();
      element = null;
      program = stack[stack.length - 1];
    },
    onattribute: function (name, value) {
      element.attributes.push(new yy.DOM.Attribute(name, value));
    },
    ontext: function (text) {
      program.statements.push(new yy.DOM.Text(text));
    },
    onprocessinginstruction: function () {
      throw new Error('Processing instructions are not supported in HTML');
    },
    oncomment: function (data) {
      program.statements.push(new yy.DOM.Comment(data));
    },
    onerror: function (error) {
      throw error;
    }
  });

  parser.write(html);
  parser.end();

  /**
   * Recursively parses nested DOM elements as Handlebars templates.
   *
   * @param  {Object} program
   * @param  {Object} originalProgram
   * @return {Object}
   */
  var ast = (function recurse (program, originalProgram) {
    var statements = program.statements;

    for (var i = 0; i < statements.length; i++) {
      var statement = statements[i];

      if (statement.type === 'DOM_TEXT' || statement.type === 'DOM_COMMENT') {
        statement.text = parseProgram(statement.text, originalProgram);
      } else if (statement.type === 'DOM_ELEMENT') {
        statement.name = parseProgram(statement.name, originalProgram);

        for (var k = 0; k < statement.attributes.length; k++) {
          var attribute = statement.attributes[k];

          attribute.name  = parseProgram(attribute.name,  originalProgram);
          attribute.value = parseProgram(attribute.value, originalProgram);
        }

        recurse(statement.content, originalProgram);
      }
    }

    return program;
  })(stack.pop(), originalProgram);

  return ast;
};

/**
 * The parser is a simple constructor. All the functionality is on the prototype
 * object.
 */
var Parser = function () {
  this.yy = {};
};

/**
 * Alias the parser constructor function.
 *
 * @type {Function}
 */
Parser.prototype.Parser = Parser;

/**
 * The primary functionality of the parser. Pushes the input text through
 * Handlebars and a HTML parser, generating a AST for use with the compiler.
 *
 * @param  {String} input
 * @return {Object}
 */
Parser.prototype.parse = function (input) {
  HbsParser.yy = this.yy;

  // Parse it as a Handlebars to extract the important nodes first. Then we
  // stringify the node to something the HTML parser can handle. The AST the
  // HTML parser generates will be parsed using Handlebars again to inject the
  // original nodes back.
  return parseAsHTML(HbsParser.parse(input));
};

/**
 * Export a static instance of the parser.
 *
 * @type {Parser}
 */
module.exports = new Parser();

},{"handlebars/lib/handlebars/compiler/parser":26,"htmlparser2/lib/Parser":31}],11:[function(require,module,exports){
var printer = require('handlebars/lib/handlebars/compiler/printer');

module.exports = printer;

},{"handlebars/lib/handlebars/compiler/printer":27}],12:[function(require,module,exports){
var visitor = require('handlebars/lib/handlebars/compiler/visitor');

module.exports = visitor;

},{"handlebars/lib/handlebars/compiler/visitor":28}],13:[function(require,module,exports){
var runtime = require('handlebars/lib/handlebars/runtime');

/**
 * Attribute runtime features to the DOMBars instance.
 *
 * @param  {Object} DOMBars
 * @return {Object}
 */
exports.attach = function(DOMBars) {
  runtime.attach(DOMBars);

  /**
   * Get a specific value using DOMBars based on different types.
   *
   * @param  {Object} parent
   * @param  {String} name
   * @param  {String} type
   * @return {*}
   */
  var get = function (parent, name, type) {
    if (type === 'context') {
      return DOMBars.get(parent, name);
    }

    if (type === 'self') {
      return parent;
    }

    return parent[name];
  };

  /**
   * Generate an executable template from a template spec.
   *
   * @param  {Object}   templateSpec
   * @return {Function}
   */
  DOMBars.VM.template = DOMBars.template = function (templateSpec) {
    var DOMBars = this;

    /**
     * The container object holds all the functions used by the template spec.
     *
     * @type {Object}
     */
    var container = DOMBars.createFrame(DOMBars.Utils.EventEmitter.prototype);

    DOMBars.Utils.extend(container, {
      isElement:         DOMBars.Utils.isElement,
      appendChild:       DOMBars.Utils.appendChild,
      replaceNode:       DOMBars.Utils.replaceNode,
      createElement:     DOMBars.Utils.createElement,
      setAttribute:      DOMBars.Utils.setAttribute,
      removeAttribute:   DOMBars.Utils.removeAttribute,
      invokePartial:     DOMBars.VM.invokePartial,
      domifyExpression:  DOMBars.Utils.domifyExpression,
      escapeExpression:  DOMBars.Utils.escapeExpression,
      textifyExpression: DOMBars.Utils.textifyExpression,
      programs: [],
      program: function (i, fn, data) {
        var programWrapper = this.programs[i];

        if (data) {
          return DOMBars.VM.program(i, fn, data);
        }

        if (!programWrapper) {
          return this.programs[i] = DOMBars.VM.program(i, fn);
        }

        return programWrapper;
      },
      merge: function (param, common) {
        var ret = param || common;

        if (param && common) {
          ret = {};
          DOMBars.Utils.extend(ret, common);
          DOMBars.Utils.extend(ret, param);
        }

        return ret;
      },
      noop:             DOMBars.VM.noop,
      compilerInfo:     null,
      subscriptions:    [],
      programWithDepth: DOMBars.VM.programWithDepth,
      get: function (parent, name, type) {
        // Push every request into the subscriptions array automatically.
        container.subscriptions.push([parent, name, type]);

        return get(parent, name, type);
      },
      subscribe: function (program, fn) {
        var subscription = container.subscriptions.pop();

        var parent = subscription[0];
        var name   = subscription[1];
        var type   = subscription[2];

        var cb = function () {
          container.emit('change ' + program);

          return fn && fn(get(parent, name, type));
        };

        if (type === 'context') {
          return DOMBars.subscribe(parent, name, cb);
        }
      }
    });

    /**
     * Return the compiled JavaScript function for execution.
     *
     * @param  {Object} context
     * @param  {Object} options
     * @return {Node}
     */
    return function (context, options) {
      options = options || {};

      var result = templateSpec.call(
        container,
        DOMBars,
        context,
        options.helpers,
        options.partials,
        options.data
      );

      var compilerInfo     = container.compilerInfo || [];
      var compilerRevision = compilerInfo[0] || 1;
      var currentRevision  = DOMBars.COMPILER_REVISION;

      if (compilerRevision !== currentRevision) {
        if (compilerRevision < currentRevision) {
          var runtimeVersions  = DOMBars.REVISION_CHANGES[currentRevision];
          var compilerVersions = DOMBars.REVISION_CHANGES[compilerRevision];
          throw new Error('Template was precompiled with an older version of ' +
            'DOMBars than the current runtime. Please update your precompiler' +
            ' to a newer version (' + runtimeVersions + ') or downgrade your ' +
            'runtime to an older version (' + compilerVersions + ').');
        }

        throw new Error('Template was precompiled with a newer version of' +
          'DOMBars than the current runtime. Please update your runtime to ' +
          'a newer version (' + compilerInfo[1] + ').');
      }

      return result;
    };
  };

  return DOMBars;
};

},{"handlebars/lib/handlebars/runtime":29}],14:[function(require,module,exports){
var utils  = require('handlebars/lib/handlebars/utils');
var domify = require('domify');

/**
 * Attach reusable utility functions to the DOMBars instance.
 *
 * @param  {Object} DOMBars
 * @return {Object}
 */
exports.attach = function (DOMBars) {
  utils.attach(DOMBars);

  /**
   * Require an event emitter class.
   *
   * @type {Object}
   */
  DOMBars.Utils.EventEmitter = require('events').EventEmitter;

  /**
   * Check whether an object is actually a DOM node.
   *
   * @param  {*}       element
   * @return {Boolean}
   */
  DOMBars.Utils.isElement = function (element) {
    return element instanceof Node;
  };

  /**
   * Create an element from a tag name.
   *
   * @param  {String} tagName
   * @return {Node}
   */
  DOMBars.Utils.createElement = function (tagName) {
    return document.createElement(tagName);
  };

  /**
   * Replace a node in the DOM with a new node and return it.
   *
   * @param  {Node} newNode
   * @param  {Node} oldNode
   * @return {Node}
   */
  DOMBars.Utils.replaceNode = function (newNode, oldNode) {
    oldNode.parentNode.replaceChild(newNode, oldNode);
    return newNode;
  };

  /**
   * Set an attribute value on an element.
   *
   * @param {Node}   element
   * @param {String} name
   * @param {*}      value
   */
  DOMBars.Utils.setAttribute = function (element, name, value) {
    element.setAttribute(name, value);
  };

  /**
   * Remove an attribute from an element.
   *
   * @param {Node}   element
   * @param {String} name
   */
  DOMBars.Utils.removeAttribute = function (element, name) {
    element.removeAttribute(name);
  };

  /**
   * Append a child element to a DOM node.
   *
   * @param {Node} element
   * @param {Node} child
   */
  DOMBars.Utils.appendChild = function (element, child) {
    element.appendChild(child);
  };

  /**
   * Transform a string into arbitrary DOM nodes.
   *
   * @param  {String} string
   * @return {Node}
   */
  DOMBars.Utils.domifyExpression = function (string) {
    if (DOMBars.Utils.isElement(string)) {
      return string;
    }

    try {
      return domify(string.toString());
    } catch (e) {
      return document.createTextNode(string);
    }
  };

  /**
   * Transform a string into a DOM text node for appending to the template.
   *
   * @param  {String} string
   * @return {Text}
   */
  DOMBars.Utils.textifyExpression = function (string) {
    if (string instanceof DOMBars.SafeString) {
      return DOMBars.Utils.domifyExpression(string.toString());
    } else if (string == null || string === false) {
      return document.createTextNode('');
    }

    // Catch when the string is actually a DOM node and turn it into a string.
    if (DOMBars.Utils.isElement(string)) {
      if (string.outerHTML) {
        return document.createTextNode(string.outerHTML);
      }

      var div = document.createElement('div');
      var outerHTML;

      DOMBars.Utils.appendChild(div, string.cloneNode(true));
      outerHTML = div.innerHTML;
      div       = null;

      return document.createTextNode(outerHTML);
    }

    return document.createTextNode(string);
  };

  return DOMBars;
};

},{"domify":15,"events":17,"handlebars/lib/handlebars/utils":30}],15:[function(require,module,exports){

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Wrap map from jquery.
 */

var map = {
  option: [1, '<select multiple="multiple">', '</select>'],
  optgroup: [1, '<select multiple="multiple">', '</select>'],
  legend: [1, '<fieldset>', '</fieldset>'],
  thead: [1, '<table>', '</table>'],
  tbody: [1, '<table>', '</table>'],
  tfoot: [1, '<table>', '</table>'],
  colgroup: [1, '<table>', '</table>'],
  caption: [1, '<table>', '</table>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  td: [3, '<table><tbody><tr>', '</tr></tbody></table>'],
  th: [3, '<table><tbody><tr>', '</tr></tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  _default: [0, '', '']
};

/**
 * Parse `html` and return the children.
 *
 * @param {String} html
 * @return {Array}
 * @api private
 */

function parse(html) {
  if ('string' != typeof html) throw new TypeError('String expected');

  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) throw new Error('No elements were generated.');
  var tag = m[1];

  // body support
  if (tag == 'body') {
    var el = document.createElement('html');
    el.innerHTML = html;
    return el.removeChild(el.lastChild);
  }

  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  var el = document.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) el = el.lastChild;

  var els = el.children;
  if (1 == els.length) {
    return el.removeChild(els[0]);
  }

  var fragment = document.createDocumentFragment();
  while (els.length) {
    fragment.appendChild(el.removeChild(els[0]));
  }

  return fragment;
}

},{}],16:[function(require,module,exports){


//
// The shims in this file are not fully implemented shims for the ES5
// features, but do work for the particular usecases there is in
// the other modules.
//

var toString = Object.prototype.toString;
var hasOwnProperty = Object.prototype.hasOwnProperty;

// Array.isArray is supported in IE9
function isArray(xs) {
  return toString.call(xs) === '[object Array]';
}
exports.isArray = typeof Array.isArray === 'function' ? Array.isArray : isArray;

// Array.prototype.indexOf is supported in IE9
exports.indexOf = function indexOf(xs, x) {
  if (xs.indexOf) return xs.indexOf(x);
  for (var i = 0; i < xs.length; i++) {
    if (x === xs[i]) return i;
  }
  return -1;
};

// Array.prototype.filter is supported in IE9
exports.filter = function filter(xs, fn) {
  if (xs.filter) return xs.filter(fn);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    if (fn(xs[i], i, xs)) res.push(xs[i]);
  }
  return res;
};

// Array.prototype.forEach is supported in IE9
exports.forEach = function forEach(xs, fn, self) {
  if (xs.forEach) return xs.forEach(fn, self);
  for (var i = 0; i < xs.length; i++) {
    fn.call(self, xs[i], i, xs);
  }
};

// Array.prototype.map is supported in IE9
exports.map = function map(xs, fn) {
  if (xs.map) return xs.map(fn);
  var out = new Array(xs.length);
  for (var i = 0; i < xs.length; i++) {
    out[i] = fn(xs[i], i, xs);
  }
  return out;
};

// Array.prototype.reduce is supported in IE9
exports.reduce = function reduce(array, callback, opt_initialValue) {
  if (array.reduce) return array.reduce(callback, opt_initialValue);
  var value, isValueSet = false;

  if (2 < arguments.length) {
    value = opt_initialValue;
    isValueSet = true;
  }
  for (var i = 0, l = array.length; l > i; ++i) {
    if (array.hasOwnProperty(i)) {
      if (isValueSet) {
        value = callback(value, array[i], i, array);
      }
      else {
        value = array[i];
        isValueSet = true;
      }
    }
  }

  return value;
};

// String.prototype.substr - negative index don't work in IE8
if ('ab'.substr(-1) !== 'b') {
  exports.substr = function (str, start, length) {
    // did we get a negative start, calculate how much it is from the beginning of the string
    if (start < 0) start = str.length + start;

    // call the original function
    return str.substr(start, length);
  };
} else {
  exports.substr = function (str, start, length) {
    return str.substr(start, length);
  };
}

// String.prototype.trim is supported in IE9
exports.trim = function (str) {
  if (str.trim) return str.trim();
  return str.replace(/^\s+|\s+$/g, '');
};

// Function.prototype.bind is supported in IE9
exports.bind = function () {
  var args = Array.prototype.slice.call(arguments);
  var fn = args.shift();
  if (fn.bind) return fn.bind.apply(fn, args);
  var self = args.shift();
  return function () {
    fn.apply(self, args.concat([Array.prototype.slice.call(arguments)]));
  };
};

// Object.create is supported in IE9
function create(prototype, properties) {
  var object;
  if (prototype === null) {
    object = { '__proto__' : null };
  }
  else {
    if (typeof prototype !== 'object') {
      throw new TypeError(
        'typeof prototype[' + (typeof prototype) + '] != \'object\''
      );
    }
    var Type = function () {};
    Type.prototype = prototype;
    object = new Type();
    object.__proto__ = prototype;
  }
  if (typeof properties !== 'undefined' && Object.defineProperties) {
    Object.defineProperties(object, properties);
  }
  return object;
}
exports.create = typeof Object.create === 'function' ? Object.create : create;

// Object.keys and Object.getOwnPropertyNames is supported in IE9 however
// they do show a description and number property on Error objects
function notObject(object) {
  return ((typeof object != "object" && typeof object != "function") || object === null);
}

function keysShim(object) {
  if (notObject(object)) {
    throw new TypeError("Object.keys called on a non-object");
  }

  var result = [];
  for (var name in object) {
    if (hasOwnProperty.call(object, name)) {
      result.push(name);
    }
  }
  return result;
}

// getOwnPropertyNames is almost the same as Object.keys one key feature
//  is that it returns hidden properties, since that can't be implemented,
//  this feature gets reduced so it just shows the length property on arrays
function propertyShim(object) {
  if (notObject(object)) {
    throw new TypeError("Object.getOwnPropertyNames called on a non-object");
  }

  var result = keysShim(object);
  if (exports.isArray(object) && exports.indexOf(object, 'length') === -1) {
    result.push('length');
  }
  return result;
}

var keys = typeof Object.keys === 'function' ? Object.keys : keysShim;
var getOwnPropertyNames = typeof Object.getOwnPropertyNames === 'function' ?
  Object.getOwnPropertyNames : propertyShim;

if (new Error().hasOwnProperty('description')) {
  var ERROR_PROPERTY_FILTER = function (obj, array) {
    if (toString.call(obj) === '[object Error]') {
      array = exports.filter(array, function (name) {
        return name !== 'description' && name !== 'number' && name !== 'message';
      });
    }
    return array;
  };

  exports.keys = function (object) {
    return ERROR_PROPERTY_FILTER(object, keys(object));
  };
  exports.getOwnPropertyNames = function (object) {
    return ERROR_PROPERTY_FILTER(object, getOwnPropertyNames(object));
  };
} else {
  exports.keys = keys;
  exports.getOwnPropertyNames = getOwnPropertyNames;
}

// Object.getOwnPropertyDescriptor - supported in IE8 but only on dom elements
function valueObject(value, key) {
  return { value: value[key] };
}

if (typeof Object.getOwnPropertyDescriptor === 'function') {
  try {
    Object.getOwnPropertyDescriptor({'a': 1}, 'a');
    exports.getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  } catch (e) {
    // IE8 dom element issue - use a try catch and default to valueObject
    exports.getOwnPropertyDescriptor = function (value, key) {
      try {
        return Object.getOwnPropertyDescriptor(value, key);
      } catch (e) {
        return valueObject(value, key);
      }
    };
  }
} else {
  exports.getOwnPropertyDescriptor = valueObject;
}

},{}],17:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util');

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!util.isNumber(n) || n < 0)
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (util.isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (util.isUndefined(handler))
    return false;

  if (util.isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (util.isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              util.isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (util.isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (util.isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!util.isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  function g() {
    this.removeListener(type, g);
    listener.apply(this, arguments);
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (util.isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (util.isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (util.isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (util.isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (util.isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};
},{"util":19}],18:[function(require,module,exports){

// not implemented
// The reason for having an empty file and not throwing is to allow
// untraditional implementation of this module.

},{}],19:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var shims = require('_shims');

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};

/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  shims.forEach(array, function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = shims.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = shims.getOwnPropertyNames(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }

  shims.forEach(keys, function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = shims.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }

  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (shims.indexOf(ctx.seen, desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = shims.reduce(output, function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return shims.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) && objectToString(e) === '[object Error]';
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.binarySlice === 'function'
  ;
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = shims.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = shims.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

},{"_shims":16}],20:[function(require,module,exports){
var handlebars = require("./handlebars/base"),

// Each of these augment the Handlebars object. No need to setup here.
// (This is done to easily share code between commonjs and browse envs)
  utils = require("./handlebars/utils"),
  compiler = require("./handlebars/compiler"),
  runtime = require("./handlebars/runtime");

var create = function() {
  var hb = handlebars.create();

  utils.attach(hb);
  compiler.attach(hb);
  runtime.attach(hb);

  return hb;
};

var Handlebars = create();
Handlebars.create = create;

module.exports = Handlebars; // instantiate an instance

// Publish a Node.js require() handler for .handlebars and .hbs files
if (require.extensions) {
  var extension = function(module, filename) {
    var fs = require("fs");
    var templateString = fs.readFileSync(filename, "utf8");
    module.exports = Handlebars.compile(templateString);
  };
  require.extensions[".handlebars"] = extension;
  require.extensions[".hbs"] = extension;
}

// BEGIN(BROWSER)

// END(BROWSER)

// USAGE:
// var handlebars = require('handlebars');

// var singleton = handlebars.Handlebars,
//  local = handlebars.create();

},{"./handlebars/base":21,"./handlebars/compiler":25,"./handlebars/runtime":29,"./handlebars/utils":30,"fs":18}],21:[function(require,module,exports){
/*jshint eqnull: true */

module.exports.create = function() {

var Handlebars = {};

// BEGIN(BROWSER)

Handlebars.VERSION = "1.0.0";
Handlebars.COMPILER_REVISION = 4;

Handlebars.REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '>= 1.0.0'
};

Handlebars.helpers  = {};
Handlebars.partials = {};

var toString = Object.prototype.toString,
    functionType = '[object Function]',
    objectType = '[object Object]';

Handlebars.registerHelper = function(name, fn, inverse) {
  if (toString.call(name) === objectType) {
    if (inverse || fn) { throw new Handlebars.Exception('Arg not supported with multiple helpers'); }
    Handlebars.Utils.extend(this.helpers, name);
  } else {
    if (inverse) { fn.not = inverse; }
    this.helpers[name] = fn;
  }
};

Handlebars.registerPartial = function(name, str) {
  if (toString.call(name) === objectType) {
    Handlebars.Utils.extend(this.partials,  name);
  } else {
    this.partials[name] = str;
  }
};

Handlebars.registerHelper('helperMissing', function(arg) {
  if(arguments.length === 2) {
    return undefined;
  } else {
    throw new Error("Missing helper: '" + arg + "'");
  }
});

Handlebars.registerHelper('blockHelperMissing', function(context, options) {
  var inverse = options.inverse || function() {}, fn = options.fn;

  var type = toString.call(context);

  if(type === functionType) { context = context.call(this); }

  if(context === true) {
    return fn(this);
  } else if(context === false || context == null) {
    return inverse(this);
  } else if(type === "[object Array]") {
    if(context.length > 0) {
      return Handlebars.helpers.each(context, options);
    } else {
      return inverse(this);
    }
  } else {
    return fn(context);
  }
});

Handlebars.K = function() {};

Handlebars.createFrame = Object.create || function(object) {
  Handlebars.K.prototype = object;
  var obj = new Handlebars.K();
  Handlebars.K.prototype = null;
  return obj;
};

Handlebars.logger = {
  DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, level: 3,

  methodMap: {0: 'debug', 1: 'info', 2: 'warn', 3: 'error'},

  // can be overridden in the host environment
  log: function(level, obj) {
    if (Handlebars.logger.level <= level) {
      var method = Handlebars.logger.methodMap[level];
      if (typeof console !== 'undefined' && console[method]) {
        console[method].call(console, obj);
      }
    }
  }
};

Handlebars.log = function(level, obj) { Handlebars.logger.log(level, obj); };

Handlebars.registerHelper('each', function(context, options) {
  var fn = options.fn, inverse = options.inverse;
  var i = 0, ret = "", data;

  var type = toString.call(context);
  if(type === functionType) { context = context.call(this); }

  if (options.data) {
    data = Handlebars.createFrame(options.data);
  }

  if(context && typeof context === 'object') {
    if(context instanceof Array){
      for(var j = context.length; i<j; i++) {
        if (data) { data.index = i; }
        ret = ret + fn(context[i], { data: data });
      }
    } else {
      for(var key in context) {
        if(context.hasOwnProperty(key)) {
          if(data) { data.key = key; }
          ret = ret + fn(context[key], {data: data});
          i++;
        }
      }
    }
  }

  if(i === 0){
    ret = inverse(this);
  }

  return ret;
});

Handlebars.registerHelper('if', function(conditional, options) {
  var type = toString.call(conditional);
  if(type === functionType) { conditional = conditional.call(this); }

  if(!conditional || Handlebars.Utils.isEmpty(conditional)) {
    return options.inverse(this);
  } else {
    return options.fn(this);
  }
});

Handlebars.registerHelper('unless', function(conditional, options) {
  return Handlebars.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn});
});

Handlebars.registerHelper('with', function(context, options) {
  var type = toString.call(context);
  if(type === functionType) { context = context.call(this); }

  if (!Handlebars.Utils.isEmpty(context)) return options.fn(context);
});

Handlebars.registerHelper('log', function(context, options) {
  var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
  Handlebars.log(level, context);
});

// END(BROWSER)

return Handlebars;
};

},{}],22:[function(require,module,exports){
exports.attach = function(Handlebars) {

// BEGIN(BROWSER)
Handlebars.AST = {};

Handlebars.AST.ProgramNode = function(statements, inverse) {
  this.type = "program";
  this.statements = statements;
  if(inverse) { this.inverse = new Handlebars.AST.ProgramNode(inverse); }
};

Handlebars.AST.MustacheNode = function(rawParams, hash, unescaped) {
  this.type = "mustache";
  this.escaped = !unescaped;
  this.hash = hash;

  var id = this.id = rawParams[0];
  var params = this.params = rawParams.slice(1);

  // a mustache is an eligible helper if:
  // * its id is simple (a single part, not `this` or `..`)
  var eligibleHelper = this.eligibleHelper = id.isSimple;

  // a mustache is definitely a helper if:
  // * it is an eligible helper, and
  // * it has at least one parameter or hash segment
  this.isHelper = eligibleHelper && (params.length || hash);

  // if a mustache is an eligible helper but not a definite
  // helper, it is ambiguous, and will be resolved in a later
  // pass or at runtime.
};

Handlebars.AST.PartialNode = function(partialName, context) {
  this.type         = "partial";
  this.partialName  = partialName;
  this.context      = context;
};

Handlebars.AST.BlockNode = function(mustache, program, inverse, close) {
  var verifyMatch = function(open, close) {
    if(open.original !== close.original) {
      throw new Handlebars.Exception(open.original + " doesn't match " + close.original);
    }
  };

  verifyMatch(mustache.id, close);
  this.type = "block";
  this.mustache = mustache;
  this.program  = program;
  this.inverse  = inverse;

  if (this.inverse && !this.program) {
    this.isInverse = true;
  }
};

Handlebars.AST.ContentNode = function(string) {
  this.type = "content";
  this.string = string;
};

Handlebars.AST.HashNode = function(pairs) {
  this.type = "hash";
  this.pairs = pairs;
};

Handlebars.AST.IdNode = function(parts) {
  this.type = "ID";

  var original = "",
      dig = [],
      depth = 0;

  for(var i=0,l=parts.length; i<l; i++) {
    var part = parts[i].part;
    original += (parts[i].separator || '') + part;

    if (part === ".." || part === "." || part === "this") {
      if (dig.length > 0) { throw new Handlebars.Exception("Invalid path: " + original); }
      else if (part === "..") { depth++; }
      else { this.isScoped = true; }
    }
    else { dig.push(part); }
  }

  this.original = original;
  this.parts    = dig;
  this.string   = dig.join('.');
  this.depth    = depth;

  // an ID is simple if it only has one part, and that part is not
  // `..` or `this`.
  this.isSimple = parts.length === 1 && !this.isScoped && depth === 0;

  this.stringModeValue = this.string;
};

Handlebars.AST.PartialNameNode = function(name) {
  this.type = "PARTIAL_NAME";
  this.name = name.original;
};

Handlebars.AST.DataNode = function(id) {
  this.type = "DATA";
  this.id = id;
};

Handlebars.AST.StringNode = function(string) {
  this.type = "STRING";
  this.original =
    this.string =
    this.stringModeValue = string;
};

Handlebars.AST.IntegerNode = function(integer) {
  this.type = "INTEGER";
  this.original =
    this.integer = integer;
  this.stringModeValue = Number(integer);
};

Handlebars.AST.BooleanNode = function(bool) {
  this.type = "BOOLEAN";
  this.bool = bool;
  this.stringModeValue = bool === "true";
};

Handlebars.AST.CommentNode = function(comment) {
  this.type = "comment";
  this.comment = comment;
};

// END(BROWSER)

return Handlebars;
};


},{}],23:[function(require,module,exports){
var handlebars = require("./parser");

exports.attach = function(Handlebars) {

// BEGIN(BROWSER)

Handlebars.Parser = handlebars;

Handlebars.parse = function(input) {

  // Just return if an already-compile AST was passed in.
  if(input.constructor === Handlebars.AST.ProgramNode) { return input; }

  Handlebars.Parser.yy = Handlebars.AST;
  return Handlebars.Parser.parse(input);
};

// END(BROWSER)

return Handlebars;
};

},{"./parser":26}],24:[function(require,module,exports){
var compilerbase = require("./base");

exports.attach = function(Handlebars) {

compilerbase.attach(Handlebars);

// BEGIN(BROWSER)

/*jshint eqnull:true*/
var Compiler = Handlebars.Compiler = function() {};
var JavaScriptCompiler = Handlebars.JavaScriptCompiler = function() {};

// the foundHelper register will disambiguate helper lookup from finding a
// function in a context. This is necessary for mustache compatibility, which
// requires that context functions in blocks are evaluated by blockHelperMissing,
// and then proceed as if the resulting value was provided to blockHelperMissing.

Compiler.prototype = {
  compiler: Compiler,

  disassemble: function() {
    var opcodes = this.opcodes, opcode, out = [], params, param;

    for (var i=0, l=opcodes.length; i<l; i++) {
      opcode = opcodes[i];

      if (opcode.opcode === 'DECLARE') {
        out.push("DECLARE " + opcode.name + "=" + opcode.value);
      } else {
        params = [];
        for (var j=0; j<opcode.args.length; j++) {
          param = opcode.args[j];
          if (typeof param === "string") {
            param = "\"" + param.replace("\n", "\\n") + "\"";
          }
          params.push(param);
        }
        out.push(opcode.opcode + " " + params.join(" "));
      }
    }

    return out.join("\n");
  },
  equals: function(other) {
    var len = this.opcodes.length;
    if (other.opcodes.length !== len) {
      return false;
    }

    for (var i = 0; i < len; i++) {
      var opcode = this.opcodes[i],
          otherOpcode = other.opcodes[i];
      if (opcode.opcode !== otherOpcode.opcode || opcode.args.length !== otherOpcode.args.length) {
        return false;
      }
      for (var j = 0; j < opcode.args.length; j++) {
        if (opcode.args[j] !== otherOpcode.args[j]) {
          return false;
        }
      }
    }

    len = this.children.length;
    if (other.children.length !== len) {
      return false;
    }
    for (i = 0; i < len; i++) {
      if (!this.children[i].equals(other.children[i])) {
        return false;
      }
    }

    return true;
  },

  guid: 0,

  compile: function(program, options) {
    this.children = [];
    this.depths = {list: []};
    this.options = options;

    // These changes will propagate to the other compiler components
    var knownHelpers = this.options.knownHelpers;
    this.options.knownHelpers = {
      'helperMissing': true,
      'blockHelperMissing': true,
      'each': true,
      'if': true,
      'unless': true,
      'with': true,
      'log': true
    };
    if (knownHelpers) {
      for (var name in knownHelpers) {
        this.options.knownHelpers[name] = knownHelpers[name];
      }
    }

    return this.program(program);
  },

  accept: function(node) {
    return this[node.type](node);
  },

  program: function(program) {
    var statements = program.statements, statement;
    this.opcodes = [];

    for(var i=0, l=statements.length; i<l; i++) {
      statement = statements[i];
      this[statement.type](statement);
    }
    this.isSimple = l === 1;

    this.depths.list = this.depths.list.sort(function(a, b) {
      return a - b;
    });

    return this;
  },

  compileProgram: function(program) {
    var result = new this.compiler().compile(program, this.options);
    var guid = this.guid++, depth;

    this.usePartial = this.usePartial || result.usePartial;

    this.children[guid] = result;

    for(var i=0, l=result.depths.list.length; i<l; i++) {
      depth = result.depths.list[i];

      if(depth < 2) { continue; }
      else { this.addDepth(depth - 1); }
    }

    return guid;
  },

  block: function(block) {
    var mustache = block.mustache,
        program = block.program,
        inverse = block.inverse;

    if (program) {
      program = this.compileProgram(program);
    }

    if (inverse) {
      inverse = this.compileProgram(inverse);
    }

    var type = this.classifyMustache(mustache);

    if (type === "helper") {
      this.helperMustache(mustache, program, inverse);
    } else if (type === "simple") {
      this.simpleMustache(mustache);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('blockValue');
    } else {
      this.ambiguousMustache(mustache, program, inverse);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('ambiguousBlockValue');
    }

    this.opcode('append');
  },

  hash: function(hash) {
    var pairs = hash.pairs, pair, val;

    this.opcode('pushHash');

    for(var i=0, l=pairs.length; i<l; i++) {
      pair = pairs[i];
      val  = pair[1];

      if (this.options.stringParams) {
        if(val.depth) {
          this.addDepth(val.depth);
        }
        this.opcode('getContext', val.depth || 0);
        this.opcode('pushStringParam', val.stringModeValue, val.type);
      } else {
        this.accept(val);
      }

      this.opcode('assignToHash', pair[0]);
    }
    this.opcode('popHash');
  },

  partial: function(partial) {
    var partialName = partial.partialName;
    this.usePartial = true;

    if(partial.context) {
      this.ID(partial.context);
    } else {
      this.opcode('push', 'depth0');
    }

    this.opcode('invokePartial', partialName.name);
    this.opcode('append');
  },

  content: function(content) {
    this.opcode('appendContent', content.string);
  },

  mustache: function(mustache) {
    var options = this.options;
    var type = this.classifyMustache(mustache);

    if (type === "simple") {
      this.simpleMustache(mustache);
    } else if (type === "helper") {
      this.helperMustache(mustache);
    } else {
      this.ambiguousMustache(mustache);
    }

    if(mustache.escaped && !options.noEscape) {
      this.opcode('appendEscaped');
    } else {
      this.opcode('append');
    }
  },

  ambiguousMustache: function(mustache, program, inverse) {
    var id = mustache.id,
        name = id.parts[0],
        isBlock = program != null || inverse != null;

    this.opcode('getContext', id.depth);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    this.opcode('invokeAmbiguous', name, isBlock);
  },

  simpleMustache: function(mustache) {
    var id = mustache.id;

    if (id.type === 'DATA') {
      this.DATA(id);
    } else if (id.parts.length) {
      this.ID(id);
    } else {
      // Simplified ID for `this`
      this.addDepth(id.depth);
      this.opcode('getContext', id.depth);
      this.opcode('pushContext');
    }

    this.opcode('resolvePossibleLambda');
  },

  helperMustache: function(mustache, program, inverse) {
    var params = this.setupFullMustacheParams(mustache, program, inverse),
        name = mustache.id.parts[0];

    if (this.options.knownHelpers[name]) {
      this.opcode('invokeKnownHelper', params.length, name);
    } else if (this.options.knownHelpersOnly) {
      throw new Error("You specified knownHelpersOnly, but used the unknown helper " + name);
    } else {
      this.opcode('invokeHelper', params.length, name);
    }
  },

  ID: function(id) {
    this.addDepth(id.depth);
    this.opcode('getContext', id.depth);

    var name = id.parts[0];
    if (!name) {
      this.opcode('pushContext');
    } else {
      this.opcode('lookupOnContext', id.parts[0]);
    }

    for(var i=1, l=id.parts.length; i<l; i++) {
      this.opcode('lookup', id.parts[i]);
    }
  },

  DATA: function(data) {
    this.options.data = true;
    if (data.id.isScoped || data.id.depth) {
      throw new Handlebars.Exception('Scoped data references are not supported: ' + data.original);
    }

    this.opcode('lookupData');
    var parts = data.id.parts;
    for(var i=0, l=parts.length; i<l; i++) {
      this.opcode('lookup', parts[i]);
    }
  },

  STRING: function(string) {
    this.opcode('pushString', string.string);
  },

  INTEGER: function(integer) {
    this.opcode('pushLiteral', integer.integer);
  },

  BOOLEAN: function(bool) {
    this.opcode('pushLiteral', bool.bool);
  },

  comment: function() {},

  // HELPERS
  opcode: function(name) {
    this.opcodes.push({ opcode: name, args: [].slice.call(arguments, 1) });
  },

  declare: function(name, value) {
    this.opcodes.push({ opcode: 'DECLARE', name: name, value: value });
  },

  addDepth: function(depth) {
    if(isNaN(depth)) { throw new Error("EWOT"); }
    if(depth === 0) { return; }

    if(!this.depths[depth]) {
      this.depths[depth] = true;
      this.depths.list.push(depth);
    }
  },

  classifyMustache: function(mustache) {
    var isHelper   = mustache.isHelper;
    var isEligible = mustache.eligibleHelper;
    var options    = this.options;

    // if ambiguous, we can possibly resolve the ambiguity now
    if (isEligible && !isHelper) {
      var name = mustache.id.parts[0];

      if (options.knownHelpers[name]) {
        isHelper = true;
      } else if (options.knownHelpersOnly) {
        isEligible = false;
      }
    }

    if (isHelper) { return "helper"; }
    else if (isEligible) { return "ambiguous"; }
    else { return "simple"; }
  },

  pushParams: function(params) {
    var i = params.length, param;

    while(i--) {
      param = params[i];

      if(this.options.stringParams) {
        if(param.depth) {
          this.addDepth(param.depth);
        }

        this.opcode('getContext', param.depth || 0);
        this.opcode('pushStringParam', param.stringModeValue, param.type);
      } else {
        this[param.type](param);
      }
    }
  },

  setupMustacheParams: function(mustache) {
    var params = mustache.params;
    this.pushParams(params);

    if(mustache.hash) {
      this.hash(mustache.hash);
    } else {
      this.opcode('emptyHash');
    }

    return params;
  },

  // this will replace setupMustacheParams when we're done
  setupFullMustacheParams: function(mustache, program, inverse) {
    var params = mustache.params;
    this.pushParams(params);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    if(mustache.hash) {
      this.hash(mustache.hash);
    } else {
      this.opcode('emptyHash');
    }

    return params;
  }
};

var Literal = function(value) {
  this.value = value;
};

JavaScriptCompiler.prototype = {
  // PUBLIC API: You can override these methods in a subclass to provide
  // alternative compiled forms for name lookup and buffering semantics
  nameLookup: function(parent, name /* , type*/) {
    if (/^[0-9]+$/.test(name)) {
      return parent + "[" + name + "]";
    } else if (JavaScriptCompiler.isValidJavaScriptVariableName(name)) {
      return parent + "." + name;
    }
    else {
      return parent + "['" + name + "']";
    }
  },

  appendToBuffer: function(string) {
    if (this.environment.isSimple) {
      return "return " + string + ";";
    } else {
      return {
        appendToBuffer: true,
        content: string,
        toString: function() { return "buffer += " + string + ";"; }
      };
    }
  },

  initializeBuffer: function() {
    return this.quotedString("");
  },

  namespace: "Handlebars",
  // END PUBLIC API

  compile: function(environment, options, context, asObject) {
    this.environment = environment;
    this.options = options || {};

    Handlebars.log(Handlebars.logger.DEBUG, this.environment.disassemble() + "\n\n");

    this.name = this.environment.name;
    this.isChild = !!context;
    this.context = context || {
      programs: [],
      environments: [],
      aliases: { }
    };

    this.preamble();

    this.stackSlot = 0;
    this.stackVars = [];
    this.registers = { list: [] };
    this.compileStack = [];
    this.inlineStack = [];

    this.compileChildren(environment, options);

    var opcodes = environment.opcodes, opcode;

    this.i = 0;

    for(l=opcodes.length; this.i<l; this.i++) {
      opcode = opcodes[this.i];

      if(opcode.opcode === 'DECLARE') {
        this[opcode.name] = opcode.value;
      } else {
        this[opcode.opcode].apply(this, opcode.args);
      }
    }

    return this.createFunctionContext(asObject);
  },

  nextOpcode: function() {
    var opcodes = this.environment.opcodes;
    return opcodes[this.i + 1];
  },

  eat: function() {
    this.i = this.i + 1;
  },

  preamble: function() {
    var out = [];

    if (!this.isChild) {
      var namespace = this.namespace;

      var copies = "helpers = this.merge(helpers, " + namespace + ".helpers);";
      if (this.environment.usePartial) { copies = copies + " partials = this.merge(partials, " + namespace + ".partials);"; }
      if (this.options.data) { copies = copies + " data = data || {};"; }
      out.push(copies);
    } else {
      out.push('');
    }

    if (!this.environment.isSimple) {
      out.push(", buffer = " + this.initializeBuffer());
    } else {
      out.push("");
    }

    // track the last context pushed into place to allow skipping the
    // getContext opcode when it would be a noop
    this.lastContext = 0;
    this.source = out;
  },

  createFunctionContext: function(asObject) {
    var locals = this.stackVars.concat(this.registers.list);

    if(locals.length > 0) {
      this.source[1] = this.source[1] + ", " + locals.join(", ");
    }

    // Generate minimizer alias mappings
    if (!this.isChild) {
      for (var alias in this.context.aliases) {
        if (this.context.aliases.hasOwnProperty(alias)) {
          this.source[1] = this.source[1] + ', ' + alias + '=' + this.context.aliases[alias];
        }
      }
    }

    if (this.source[1]) {
      this.source[1] = "var " + this.source[1].substring(2) + ";";
    }

    // Merge children
    if (!this.isChild) {
      this.source[1] += '\n' + this.context.programs.join('\n') + '\n';
    }

    if (!this.environment.isSimple) {
      this.source.push("return buffer;");
    }

    var params = this.isChild ? ["depth0", "data"] : ["Handlebars", "depth0", "helpers", "partials", "data"];

    for(var i=0, l=this.environment.depths.list.length; i<l; i++) {
      params.push("depth" + this.environment.depths.list[i]);
    }

    // Perform a second pass over the output to merge content when possible
    var source = this.mergeSource();

    if (!this.isChild) {
      var revision = Handlebars.COMPILER_REVISION,
          versions = Handlebars.REVISION_CHANGES[revision];
      source = "this.compilerInfo = ["+revision+",'"+versions+"'];\n"+source;
    }

    if (asObject) {
      params.push(source);

      return Function.apply(this, params);
    } else {
      var functionSource = 'function ' + (this.name || '') + '(' + params.join(',') + ') {\n  ' + source + '}';
      Handlebars.log(Handlebars.logger.DEBUG, functionSource + "\n\n");
      return functionSource;
    }
  },
  mergeSource: function() {
    // WARN: We are not handling the case where buffer is still populated as the source should
    // not have buffer append operations as their final action.
    var source = '',
        buffer;
    for (var i = 0, len = this.source.length; i < len; i++) {
      var line = this.source[i];
      if (line.appendToBuffer) {
        if (buffer) {
          buffer = buffer + '\n    + ' + line.content;
        } else {
          buffer = line.content;
        }
      } else {
        if (buffer) {
          source += 'buffer += ' + buffer + ';\n  ';
          buffer = undefined;
        }
        source += line + '\n  ';
      }
    }
    return source;
  },

  // [blockValue]
  //
  // On stack, before: hash, inverse, program, value
  // On stack, after: return value of blockHelperMissing
  //
  // The purpose of this opcode is to take a block of the form
  // `{{#foo}}...{{/foo}}`, resolve the value of `foo`, and
  // replace it on the stack with the result of properly
  // invoking blockHelperMissing.
  blockValue: function() {
    this.context.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    var params = ["depth0"];
    this.setupParams(0, params);

    this.replaceStack(function(current) {
      params.splice(1, 0, current);
      return "blockHelperMissing.call(" + params.join(", ") + ")";
    });
  },

  // [ambiguousBlockValue]
  //
  // On stack, before: hash, inverse, program, value
  // Compiler value, before: lastHelper=value of last found helper, if any
  // On stack, after, if no lastHelper: same as [blockValue]
  // On stack, after, if lastHelper: value
  ambiguousBlockValue: function() {
    this.context.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    var params = ["depth0"];
    this.setupParams(0, params);

    var current = this.topStack();
    params.splice(1, 0, current);

    // Use the options value generated from the invocation
    params[params.length-1] = 'options';

    this.source.push("if (!" + this.lastHelper + ") { " + current + " = blockHelperMissing.call(" + params.join(", ") + "); }");
  },

  // [appendContent]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Appends the string value of `content` to the current buffer
  appendContent: function(content) {
    this.source.push(this.appendToBuffer(this.quotedString(content)));
  },

  // [append]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Coerces `value` to a String and appends it to the current buffer.
  //
  // If `value` is truthy, or 0, it is coerced into a string and appended
  // Otherwise, the empty string is appended
  append: function() {
    // Force anything that is inlined onto the stack so we don't have duplication
    // when we examine local
    this.flushInline();
    var local = this.popStack();
    this.source.push("if(" + local + " || " + local + " === 0) { " + this.appendToBuffer(local) + " }");
    if (this.environment.isSimple) {
      this.source.push("else { " + this.appendToBuffer("''") + " }");
    }
  },

  // [appendEscaped]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Escape `value` and append it to the buffer
  appendEscaped: function() {
    this.context.aliases.escapeExpression = 'this.escapeExpression';

    this.source.push(this.appendToBuffer("escapeExpression(" + this.popStack() + ")"));
  },

  // [getContext]
  //
  // On stack, before: ...
  // On stack, after: ...
  // Compiler value, after: lastContext=depth
  //
  // Set the value of the `lastContext` compiler value to the depth
  getContext: function(depth) {
    if(this.lastContext !== depth) {
      this.lastContext = depth;
    }
  },

  // [lookupOnContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext[name], ...
  //
  // Looks up the value of `name` on the current context and pushes
  // it onto the stack.
  lookupOnContext: function(name) {
    this.push(this.nameLookup('depth' + this.lastContext, name, 'context'));
  },

  // [pushContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext, ...
  //
  // Pushes the value of the current context onto the stack.
  pushContext: function() {
    this.pushStackLiteral('depth' + this.lastContext);
  },

  // [resolvePossibleLambda]
  //
  // On stack, before: value, ...
  // On stack, after: resolved value, ...
  //
  // If the `value` is a lambda, replace it on the stack by
  // the return value of the lambda
  resolvePossibleLambda: function() {
    this.context.aliases.functionType = '"function"';

    this.replaceStack(function(current) {
      return "typeof " + current + " === functionType ? " + current + ".apply(depth0) : " + current;
    });
  },

  // [lookup]
  //
  // On stack, before: value, ...
  // On stack, after: value[name], ...
  //
  // Replace the value on the stack with the result of looking
  // up `name` on `value`
  lookup: function(name) {
    this.replaceStack(function(current) {
      return current + " == null || " + current + " === false ? " + current + " : " + this.nameLookup(current, name, 'context');
    });
  },

  // [lookupData]
  //
  // On stack, before: ...
  // On stack, after: data[id], ...
  //
  // Push the result of looking up `id` on the current data
  lookupData: function(id) {
    this.push('data');
  },

  // [pushStringParam]
  //
  // On stack, before: ...
  // On stack, after: string, currentContext, ...
  //
  // This opcode is designed for use in string mode, which
  // provides the string value of a parameter along with its
  // depth rather than resolving it immediately.
  pushStringParam: function(string, type) {
    this.pushStackLiteral('depth' + this.lastContext);

    this.pushString(type);

    if (typeof string === 'string') {
      this.pushString(string);
    } else {
      this.pushStackLiteral(string);
    }
  },

  emptyHash: function() {
    this.pushStackLiteral('{}');

    if (this.options.stringParams) {
      this.register('hashTypes', '{}');
      this.register('hashContexts', '{}');
    }
  },
  pushHash: function() {
    this.hash = {values: [], types: [], contexts: []};
  },
  popHash: function() {
    var hash = this.hash;
    this.hash = undefined;

    if (this.options.stringParams) {
      this.register('hashContexts', '{' + hash.contexts.join(',') + '}');
      this.register('hashTypes', '{' + hash.types.join(',') + '}');
    }
    this.push('{\n    ' + hash.values.join(',\n    ') + '\n  }');
  },

  // [pushString]
  //
  // On stack, before: ...
  // On stack, after: quotedString(string), ...
  //
  // Push a quoted version of `string` onto the stack
  pushString: function(string) {
    this.pushStackLiteral(this.quotedString(string));
  },

  // [push]
  //
  // On stack, before: ...
  // On stack, after: expr, ...
  //
  // Push an expression onto the stack
  push: function(expr) {
    this.inlineStack.push(expr);
    return expr;
  },

  // [pushLiteral]
  //
  // On stack, before: ...
  // On stack, after: value, ...
  //
  // Pushes a value onto the stack. This operation prevents
  // the compiler from creating a temporary variable to hold
  // it.
  pushLiteral: function(value) {
    this.pushStackLiteral(value);
  },

  // [pushProgram]
  //
  // On stack, before: ...
  // On stack, after: program(guid), ...
  //
  // Push a program expression onto the stack. This takes
  // a compile-time guid and converts it into a runtime-accessible
  // expression.
  pushProgram: function(guid) {
    if (guid != null) {
      this.pushStackLiteral(this.programExpression(guid));
    } else {
      this.pushStackLiteral(null);
    }
  },

  // [invokeHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // Pops off the helper's parameters, invokes the helper,
  // and pushes the helper's return value onto the stack.
  //
  // If the helper is not found, `helperMissing` is called.
  invokeHelper: function(paramSize, name) {
    this.context.aliases.helperMissing = 'helpers.helperMissing';

    var helper = this.lastHelper = this.setupHelper(paramSize, name, true);
    var nonHelper = this.nameLookup('depth' + this.lastContext, name, 'context');

    this.push(helper.name + ' || ' + nonHelper);
    this.replaceStack(function(name) {
      return name + ' ? ' + name + '.call(' +
          helper.callParams + ") " + ": helperMissing.call(" +
          helper.helperMissingParams + ")";
    });
  },

  // [invokeKnownHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // This operation is used when the helper is known to exist,
  // so a `helperMissing` fallback is not required.
  invokeKnownHelper: function(paramSize, name) {
    var helper = this.setupHelper(paramSize, name);
    this.push(helper.name + ".call(" + helper.callParams + ")");
  },

  // [invokeAmbiguous]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of disambiguation
  //
  // This operation is used when an expression like `{{foo}}`
  // is provided, but we don't know at compile-time whether it
  // is a helper or a path.
  //
  // This operation emits more code than the other options,
  // and can be avoided by passing the `knownHelpers` and
  // `knownHelpersOnly` flags at compile-time.
  invokeAmbiguous: function(name, helperCall) {
    this.context.aliases.functionType = '"function"';

    this.pushStackLiteral('{}');    // Hash value
    var helper = this.setupHelper(0, name, helperCall);

    var helperName = this.lastHelper = this.nameLookup('helpers', name, 'helper');

    var nonHelper = this.nameLookup('depth' + this.lastContext, name, 'context');
    var nextStack = this.nextStack();

    this.source.push('if (' + nextStack + ' = ' + helperName + ') { ' + nextStack + ' = ' + nextStack + '.call(' + helper.callParams + '); }');
    this.source.push('else { ' + nextStack + ' = ' + nonHelper + '; ' + nextStack + ' = typeof ' + nextStack + ' === functionType ? ' + nextStack + '.apply(depth0) : ' + nextStack + '; }');
  },

  // [invokePartial]
  //
  // On stack, before: context, ...
  // On stack after: result of partial invocation
  //
  // This operation pops off a context, invokes a partial with that context,
  // and pushes the result of the invocation back.
  invokePartial: function(name) {
    var params = [this.nameLookup('partials', name, 'partial'), "'" + name + "'", this.popStack(), "helpers", "partials"];

    if (this.options.data) {
      params.push("data");
    }

    this.context.aliases.self = "this";
    this.push("self.invokePartial(" + params.join(", ") + ")");
  },

  // [assignToHash]
  //
  // On stack, before: value, hash, ...
  // On stack, after: hash, ...
  //
  // Pops a value and hash off the stack, assigns `hash[key] = value`
  // and pushes the hash back onto the stack.
  assignToHash: function(key) {
    var value = this.popStack(),
        context,
        type;

    if (this.options.stringParams) {
      type = this.popStack();
      context = this.popStack();
    }

    var hash = this.hash;
    if (context) {
      hash.contexts.push("'" + key + "': " + context);
    }
    if (type) {
      hash.types.push("'" + key + "': " + type);
    }
    hash.values.push("'" + key + "': (" + value + ")");
  },

  // HELPERS

  compiler: JavaScriptCompiler,

  compileChildren: function(environment, options) {
    var children = environment.children, child, compiler;

    for(var i=0, l=children.length; i<l; i++) {
      child = children[i];
      compiler = new this.compiler();

      var index = this.matchExistingProgram(child);

      if (index == null) {
        this.context.programs.push('');     // Placeholder to prevent name conflicts for nested children
        index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context);
        this.context.environments[index] = child;
      } else {
        child.index = index;
        child.name = 'program' + index;
      }
    }
  },
  matchExistingProgram: function(child) {
    for (var i = 0, len = this.context.environments.length; i < len; i++) {
      var environment = this.context.environments[i];
      if (environment && environment.equals(child)) {
        return i;
      }
    }
  },

  programExpression: function(guid) {
    this.context.aliases.self = "this";

    if(guid == null) {
      return "self.noop";
    }

    var child = this.environment.children[guid],
        depths = child.depths.list, depth;

    var programParams = [child.index, child.name, "data"];

    for(var i=0, l = depths.length; i<l; i++) {
      depth = depths[i];

      if(depth === 1) { programParams.push("depth0"); }
      else { programParams.push("depth" + (depth - 1)); }
    }

    return (depths.length === 0 ? "self.program(" : "self.programWithDepth(") + programParams.join(", ") + ")";
  },

  register: function(name, val) {
    this.useRegister(name);
    this.source.push(name + " = " + val + ";");
  },

  useRegister: function(name) {
    if(!this.registers[name]) {
      this.registers[name] = true;
      this.registers.list.push(name);
    }
  },

  pushStackLiteral: function(item) {
    return this.push(new Literal(item));
  },

  pushStack: function(item) {
    this.flushInline();

    var stack = this.incrStack();
    if (item) {
      this.source.push(stack + " = " + item + ";");
    }
    this.compileStack.push(stack);
    return stack;
  },

  replaceStack: function(callback) {
    var prefix = '',
        inline = this.isInline(),
        stack;

    // If we are currently inline then we want to merge the inline statement into the
    // replacement statement via ','
    if (inline) {
      var top = this.popStack(true);

      if (top instanceof Literal) {
        // Literals do not need to be inlined
        stack = top.value;
      } else {
        // Get or create the current stack name for use by the inline
        var name = this.stackSlot ? this.topStackName() : this.incrStack();

        prefix = '(' + this.push(name) + ' = ' + top + '),';
        stack = this.topStack();
      }
    } else {
      stack = this.topStack();
    }

    var item = callback.call(this, stack);

    if (inline) {
      if (this.inlineStack.length || this.compileStack.length) {
        this.popStack();
      }
      this.push('(' + prefix + item + ')');
    } else {
      // Prevent modification of the context depth variable. Through replaceStack
      if (!/^stack/.test(stack)) {
        stack = this.nextStack();
      }

      this.source.push(stack + " = (" + prefix + item + ");");
    }
    return stack;
  },

  nextStack: function() {
    return this.pushStack();
  },

  incrStack: function() {
    this.stackSlot++;
    if(this.stackSlot > this.stackVars.length) { this.stackVars.push("stack" + this.stackSlot); }
    return this.topStackName();
  },
  topStackName: function() {
    return "stack" + this.stackSlot;
  },
  flushInline: function() {
    var inlineStack = this.inlineStack;
    if (inlineStack.length) {
      this.inlineStack = [];
      for (var i = 0, len = inlineStack.length; i < len; i++) {
        var entry = inlineStack[i];
        if (entry instanceof Literal) {
          this.compileStack.push(entry);
        } else {
          this.pushStack(entry);
        }
      }
    }
  },
  isInline: function() {
    return this.inlineStack.length;
  },

  popStack: function(wrapped) {
    var inline = this.isInline(),
        item = (inline ? this.inlineStack : this.compileStack).pop();

    if (!wrapped && (item instanceof Literal)) {
      return item.value;
    } else {
      if (!inline) {
        this.stackSlot--;
      }
      return item;
    }
  },

  topStack: function(wrapped) {
    var stack = (this.isInline() ? this.inlineStack : this.compileStack),
        item = stack[stack.length - 1];

    if (!wrapped && (item instanceof Literal)) {
      return item.value;
    } else {
      return item;
    }
  },

  quotedString: function(str) {
    return '"' + str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')   // Per Ecma-262 7.3 + 7.8.4
      .replace(/\u2029/g, '\\u2029') + '"';
  },

  setupHelper: function(paramSize, name, missingParams) {
    var params = [];
    this.setupParams(paramSize, params, missingParams);
    var foundHelper = this.nameLookup('helpers', name, 'helper');

    return {
      params: params,
      name: foundHelper,
      callParams: ["depth0"].concat(params).join(", "),
      helperMissingParams: missingParams && ["depth0", this.quotedString(name)].concat(params).join(", ")
    };
  },

  // the params and contexts arguments are passed in arrays
  // to fill in
  setupParams: function(paramSize, params, useRegister) {
    var options = [], contexts = [], types = [], param, inverse, program;

    options.push("hash:" + this.popStack());

    inverse = this.popStack();
    program = this.popStack();

    // Avoid setting fn and inverse if neither are set. This allows
    // helpers to do a check for `if (options.fn)`
    if (program || inverse) {
      if (!program) {
        this.context.aliases.self = "this";
        program = "self.noop";
      }

      if (!inverse) {
       this.context.aliases.self = "this";
        inverse = "self.noop";
      }

      options.push("inverse:" + inverse);
      options.push("fn:" + program);
    }

    for(var i=0; i<paramSize; i++) {
      param = this.popStack();
      params.push(param);

      if(this.options.stringParams) {
        types.push(this.popStack());
        contexts.push(this.popStack());
      }
    }

    if (this.options.stringParams) {
      options.push("contexts:[" + contexts.join(",") + "]");
      options.push("types:[" + types.join(",") + "]");
      options.push("hashContexts:hashContexts");
      options.push("hashTypes:hashTypes");
    }

    if(this.options.data) {
      options.push("data:data");
    }

    options = "{" + options.join(",") + "}";
    if (useRegister) {
      this.register('options', options);
      params.push('options');
    } else {
      params.push(options);
    }
    return params.join(", ");
  }
};

var reservedWords = (
  "break else new var" +
  " case finally return void" +
  " catch for switch while" +
  " continue function this with" +
  " default if throw" +
  " delete in try" +
  " do instanceof typeof" +
  " abstract enum int short" +
  " boolean export interface static" +
  " byte extends long super" +
  " char final native synchronized" +
  " class float package throws" +
  " const goto private transient" +
  " debugger implements protected volatile" +
  " double import public let yield"
).split(" ");

var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

for(var i=0, l=reservedWords.length; i<l; i++) {
  compilerWords[reservedWords[i]] = true;
}

JavaScriptCompiler.isValidJavaScriptVariableName = function(name) {
  if(!JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]+$/.test(name)) {
    return true;
  }
  return false;
};

Handlebars.precompile = function(input, options) {
  if (input == null || (typeof input !== 'string' && input.constructor !== Handlebars.AST.ProgramNode)) {
    throw new Handlebars.Exception("You must pass a string or Handlebars AST to Handlebars.precompile. You passed " + input);
  }

  options = options || {};
  if (!('data' in options)) {
    options.data = true;
  }
  var ast = Handlebars.parse(input);
  var environment = new Compiler().compile(ast, options);
  return new JavaScriptCompiler().compile(environment, options);
};

Handlebars.compile = function(input, options) {
  if (input == null || (typeof input !== 'string' && input.constructor !== Handlebars.AST.ProgramNode)) {
    throw new Handlebars.Exception("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + input);
  }

  options = options || {};
  if (!('data' in options)) {
    options.data = true;
  }
  var compiled;
  function compile() {
    var ast = Handlebars.parse(input);
    var environment = new Compiler().compile(ast, options);
    var templateSpec = new JavaScriptCompiler().compile(environment, options, undefined, true);
    return Handlebars.template(templateSpec);
  }

  // Template is only compiled on first use and cached after that point.
  return function(context, options) {
    if (!compiled) {
      compiled = compile();
    }
    return compiled.call(this, context, options);
  };
};


// END(BROWSER)

return Handlebars;

};



},{"./base":23}],25:[function(require,module,exports){
// Each of these module will augment the Handlebars object as it loads. No need to perform addition operations
module.exports.attach = function(Handlebars) {

var visitor = require("./visitor"),
    printer = require("./printer"),
    ast = require("./ast"),
    compiler = require("./compiler");

visitor.attach(Handlebars);
printer.attach(Handlebars);
ast.attach(Handlebars);
compiler.attach(Handlebars);

return Handlebars;

};

},{"./ast":22,"./compiler":24,"./printer":27,"./visitor":28}],26:[function(require,module,exports){
// BEGIN(BROWSER)
/* Jison generated parser */
var handlebars = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"root":3,"program":4,"EOF":5,"simpleInverse":6,"statements":7,"statement":8,"openInverse":9,"closeBlock":10,"openBlock":11,"mustache":12,"partial":13,"CONTENT":14,"COMMENT":15,"OPEN_BLOCK":16,"inMustache":17,"CLOSE":18,"OPEN_INVERSE":19,"OPEN_ENDBLOCK":20,"path":21,"OPEN":22,"OPEN_UNESCAPED":23,"CLOSE_UNESCAPED":24,"OPEN_PARTIAL":25,"partialName":26,"params":27,"hash":28,"dataName":29,"param":30,"STRING":31,"INTEGER":32,"BOOLEAN":33,"hashSegments":34,"hashSegment":35,"ID":36,"EQUALS":37,"DATA":38,"pathSegments":39,"SEP":40,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",14:"CONTENT",15:"COMMENT",16:"OPEN_BLOCK",18:"CLOSE",19:"OPEN_INVERSE",20:"OPEN_ENDBLOCK",22:"OPEN",23:"OPEN_UNESCAPED",24:"CLOSE_UNESCAPED",25:"OPEN_PARTIAL",31:"STRING",32:"INTEGER",33:"BOOLEAN",36:"ID",37:"EQUALS",38:"DATA",40:"SEP"},
productions_: [0,[3,2],[4,2],[4,3],[4,2],[4,1],[4,1],[4,0],[7,1],[7,2],[8,3],[8,3],[8,1],[8,1],[8,1],[8,1],[11,3],[9,3],[10,3],[12,3],[12,3],[13,3],[13,4],[6,2],[17,3],[17,2],[17,2],[17,1],[17,1],[27,2],[27,1],[30,1],[30,1],[30,1],[30,1],[30,1],[28,1],[34,2],[34,1],[35,3],[35,3],[35,3],[35,3],[35,3],[26,1],[26,1],[26,1],[29,2],[21,1],[39,3],[39,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: return $$[$0-1]; 
break;
case 2: this.$ = new yy.ProgramNode([], $$[$0]); 
break;
case 3: this.$ = new yy.ProgramNode($$[$0-2], $$[$0]); 
break;
case 4: this.$ = new yy.ProgramNode($$[$0-1], []); 
break;
case 5: this.$ = new yy.ProgramNode($$[$0]); 
break;
case 6: this.$ = new yy.ProgramNode([], []); 
break;
case 7: this.$ = new yy.ProgramNode([]); 
break;
case 8: this.$ = [$$[$0]]; 
break;
case 9: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 10: this.$ = new yy.BlockNode($$[$0-2], $$[$0-1].inverse, $$[$0-1], $$[$0]); 
break;
case 11: this.$ = new yy.BlockNode($$[$0-2], $$[$0-1], $$[$0-1].inverse, $$[$0]); 
break;
case 12: this.$ = $$[$0]; 
break;
case 13: this.$ = $$[$0]; 
break;
case 14: this.$ = new yy.ContentNode($$[$0]); 
break;
case 15: this.$ = new yy.CommentNode($$[$0]); 
break;
case 16: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]); 
break;
case 17: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1]); 
break;
case 18: this.$ = $$[$0-1]; 
break;
case 19:
    // Parsing out the '&' escape token at this level saves ~500 bytes after min due to the removal of one parser node.
    this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1], $$[$0-2][2] === '&');
  
break;
case 20: this.$ = new yy.MustacheNode($$[$0-1][0], $$[$0-1][1], true); 
break;
case 21: this.$ = new yy.PartialNode($$[$0-1]); 
break;
case 22: this.$ = new yy.PartialNode($$[$0-2], $$[$0-1]); 
break;
case 23: 
break;
case 24: this.$ = [[$$[$0-2]].concat($$[$0-1]), $$[$0]]; 
break;
case 25: this.$ = [[$$[$0-1]].concat($$[$0]), null]; 
break;
case 26: this.$ = [[$$[$0-1]], $$[$0]]; 
break;
case 27: this.$ = [[$$[$0]], null]; 
break;
case 28: this.$ = [[$$[$0]], null]; 
break;
case 29: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 30: this.$ = [$$[$0]]; 
break;
case 31: this.$ = $$[$0]; 
break;
case 32: this.$ = new yy.StringNode($$[$0]); 
break;
case 33: this.$ = new yy.IntegerNode($$[$0]); 
break;
case 34: this.$ = new yy.BooleanNode($$[$0]); 
break;
case 35: this.$ = $$[$0]; 
break;
case 36: this.$ = new yy.HashNode($$[$0]); 
break;
case 37: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 38: this.$ = [$$[$0]]; 
break;
case 39: this.$ = [$$[$0-2], $$[$0]]; 
break;
case 40: this.$ = [$$[$0-2], new yy.StringNode($$[$0])]; 
break;
case 41: this.$ = [$$[$0-2], new yy.IntegerNode($$[$0])]; 
break;
case 42: this.$ = [$$[$0-2], new yy.BooleanNode($$[$0])]; 
break;
case 43: this.$ = [$$[$0-2], $$[$0]]; 
break;
case 44: this.$ = new yy.PartialNameNode($$[$0]); 
break;
case 45: this.$ = new yy.PartialNameNode(new yy.StringNode($$[$0])); 
break;
case 46: this.$ = new yy.PartialNameNode(new yy.IntegerNode($$[$0])); 
break;
case 47: this.$ = new yy.DataNode($$[$0]); 
break;
case 48: this.$ = new yy.IdNode($$[$0]); 
break;
case 49: $$[$0-2].push({part: $$[$0], separator: $$[$0-1]}); this.$ = $$[$0-2]; 
break;
case 50: this.$ = [{part: $$[$0]}]; 
break;
}
},
table: [{3:1,4:2,5:[2,7],6:3,7:4,8:6,9:7,11:8,12:9,13:10,14:[1,11],15:[1,12],16:[1,13],19:[1,5],22:[1,14],23:[1,15],25:[1,16]},{1:[3]},{5:[1,17]},{5:[2,6],7:18,8:6,9:7,11:8,12:9,13:10,14:[1,11],15:[1,12],16:[1,13],19:[1,19],20:[2,6],22:[1,14],23:[1,15],25:[1,16]},{5:[2,5],6:20,8:21,9:7,11:8,12:9,13:10,14:[1,11],15:[1,12],16:[1,13],19:[1,5],20:[2,5],22:[1,14],23:[1,15],25:[1,16]},{17:23,18:[1,22],21:24,29:25,36:[1,28],38:[1,27],39:26},{5:[2,8],14:[2,8],15:[2,8],16:[2,8],19:[2,8],20:[2,8],22:[2,8],23:[2,8],25:[2,8]},{4:29,6:3,7:4,8:6,9:7,11:8,12:9,13:10,14:[1,11],15:[1,12],16:[1,13],19:[1,5],20:[2,7],22:[1,14],23:[1,15],25:[1,16]},{4:30,6:3,7:4,8:6,9:7,11:8,12:9,13:10,14:[1,11],15:[1,12],16:[1,13],19:[1,5],20:[2,7],22:[1,14],23:[1,15],25:[1,16]},{5:[2,12],14:[2,12],15:[2,12],16:[2,12],19:[2,12],20:[2,12],22:[2,12],23:[2,12],25:[2,12]},{5:[2,13],14:[2,13],15:[2,13],16:[2,13],19:[2,13],20:[2,13],22:[2,13],23:[2,13],25:[2,13]},{5:[2,14],14:[2,14],15:[2,14],16:[2,14],19:[2,14],20:[2,14],22:[2,14],23:[2,14],25:[2,14]},{5:[2,15],14:[2,15],15:[2,15],16:[2,15],19:[2,15],20:[2,15],22:[2,15],23:[2,15],25:[2,15]},{17:31,21:24,29:25,36:[1,28],38:[1,27],39:26},{17:32,21:24,29:25,36:[1,28],38:[1,27],39:26},{17:33,21:24,29:25,36:[1,28],38:[1,27],39:26},{21:35,26:34,31:[1,36],32:[1,37],36:[1,28],39:26},{1:[2,1]},{5:[2,2],8:21,9:7,11:8,12:9,13:10,14:[1,11],15:[1,12],16:[1,13],19:[1,19],20:[2,2],22:[1,14],23:[1,15],25:[1,16]},{17:23,21:24,29:25,36:[1,28],38:[1,27],39:26},{5:[2,4],7:38,8:6,9:7,11:8,12:9,13:10,14:[1,11],15:[1,12],16:[1,13],19:[1,19],20:[2,4],22:[1,14],23:[1,15],25:[1,16]},{5:[2,9],14:[2,9],15:[2,9],16:[2,9],19:[2,9],20:[2,9],22:[2,9],23:[2,9],25:[2,9]},{5:[2,23],14:[2,23],15:[2,23],16:[2,23],19:[2,23],20:[2,23],22:[2,23],23:[2,23],25:[2,23]},{18:[1,39]},{18:[2,27],21:44,24:[2,27],27:40,28:41,29:48,30:42,31:[1,45],32:[1,46],33:[1,47],34:43,35:49,36:[1,50],38:[1,27],39:26},{18:[2,28],24:[2,28]},{18:[2,48],24:[2,48],31:[2,48],32:[2,48],33:[2,48],36:[2,48],38:[2,48],40:[1,51]},{21:52,36:[1,28],39:26},{18:[2,50],24:[2,50],31:[2,50],32:[2,50],33:[2,50],36:[2,50],38:[2,50],40:[2,50]},{10:53,20:[1,54]},{10:55,20:[1,54]},{18:[1,56]},{18:[1,57]},{24:[1,58]},{18:[1,59],21:60,36:[1,28],39:26},{18:[2,44],36:[2,44]},{18:[2,45],36:[2,45]},{18:[2,46],36:[2,46]},{5:[2,3],8:21,9:7,11:8,12:9,13:10,14:[1,11],15:[1,12],16:[1,13],19:[1,19],20:[2,3],22:[1,14],23:[1,15],25:[1,16]},{14:[2,17],15:[2,17],16:[2,17],19:[2,17],20:[2,17],22:[2,17],23:[2,17],25:[2,17]},{18:[2,25],21:44,24:[2,25],28:61,29:48,30:62,31:[1,45],32:[1,46],33:[1,47],34:43,35:49,36:[1,50],38:[1,27],39:26},{18:[2,26],24:[2,26]},{18:[2,30],24:[2,30],31:[2,30],32:[2,30],33:[2,30],36:[2,30],38:[2,30]},{18:[2,36],24:[2,36],35:63,36:[1,64]},{18:[2,31],24:[2,31],31:[2,31],32:[2,31],33:[2,31],36:[2,31],38:[2,31]},{18:[2,32],24:[2,32],31:[2,32],32:[2,32],33:[2,32],36:[2,32],38:[2,32]},{18:[2,33],24:[2,33],31:[2,33],32:[2,33],33:[2,33],36:[2,33],38:[2,33]},{18:[2,34],24:[2,34],31:[2,34],32:[2,34],33:[2,34],36:[2,34],38:[2,34]},{18:[2,35],24:[2,35],31:[2,35],32:[2,35],33:[2,35],36:[2,35],38:[2,35]},{18:[2,38],24:[2,38],36:[2,38]},{18:[2,50],24:[2,50],31:[2,50],32:[2,50],33:[2,50],36:[2,50],37:[1,65],38:[2,50],40:[2,50]},{36:[1,66]},{18:[2,47],24:[2,47],31:[2,47],32:[2,47],33:[2,47],36:[2,47],38:[2,47]},{5:[2,10],14:[2,10],15:[2,10],16:[2,10],19:[2,10],20:[2,10],22:[2,10],23:[2,10],25:[2,10]},{21:67,36:[1,28],39:26},{5:[2,11],14:[2,11],15:[2,11],16:[2,11],19:[2,11],20:[2,11],22:[2,11],23:[2,11],25:[2,11]},{14:[2,16],15:[2,16],16:[2,16],19:[2,16],20:[2,16],22:[2,16],23:[2,16],25:[2,16]},{5:[2,19],14:[2,19],15:[2,19],16:[2,19],19:[2,19],20:[2,19],22:[2,19],23:[2,19],25:[2,19]},{5:[2,20],14:[2,20],15:[2,20],16:[2,20],19:[2,20],20:[2,20],22:[2,20],23:[2,20],25:[2,20]},{5:[2,21],14:[2,21],15:[2,21],16:[2,21],19:[2,21],20:[2,21],22:[2,21],23:[2,21],25:[2,21]},{18:[1,68]},{18:[2,24],24:[2,24]},{18:[2,29],24:[2,29],31:[2,29],32:[2,29],33:[2,29],36:[2,29],38:[2,29]},{18:[2,37],24:[2,37],36:[2,37]},{37:[1,65]},{21:69,29:73,31:[1,70],32:[1,71],33:[1,72],36:[1,28],38:[1,27],39:26},{18:[2,49],24:[2,49],31:[2,49],32:[2,49],33:[2,49],36:[2,49],38:[2,49],40:[2,49]},{18:[1,74]},{5:[2,22],14:[2,22],15:[2,22],16:[2,22],19:[2,22],20:[2,22],22:[2,22],23:[2,22],25:[2,22]},{18:[2,39],24:[2,39],36:[2,39]},{18:[2,40],24:[2,40],36:[2,40]},{18:[2,41],24:[2,41],36:[2,41]},{18:[2,42],24:[2,42],36:[2,42]},{18:[2,43],24:[2,43],36:[2,43]},{5:[2,18],14:[2,18],15:[2,18],16:[2,18],19:[2,18],20:[2,18],22:[2,18],23:[2,18],25:[2,18]}],
defaultActions: {17:[2,1]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    this.yy.parser = this;
    if (typeof this.lexer.yylloc == "undefined")
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    var ranges = this.lexer.options && this.lexer.options.ranges;
    if (typeof this.yy.parseError === "function")
        this.parseError = this.yy.parseError;
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == "undefined") {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            var errStr = "";
            if (!recovering) {
                expected = [];
                for (p in table[state])
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                if (this.lexer.showPosition) {
                    errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                } else {
                    errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1?"end of input":"'" + (this.terminals_[symbol] || symbol) + "'");
                }
                this.parseError(errStr, {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0)
                    recovering--;
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column};
            if (ranges) {
                yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
            }
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}
};
/* Jison generated lexer */
var lexer = (function(){
var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        if (this.options.ranges) this.yylloc.range = [0,0];
        this.offset = 0;
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) this.yylloc.range[1]++;

        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length-len-1);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length-1);
        this.matched = this.matched.substr(0, this.matched.length-1);

        if (lines.length-1) this.yylineno -= lines.length-1;
        var r = this.yylloc.range;

        this.yylloc = {first_line: this.yylloc.first_line,
          last_line: this.yylineno+1,
          first_column: this.yylloc.first_column,
          last_column: lines ?
              (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length:
              this.yylloc.first_column - len
          };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
less:function (n) {
        this.unput(this.match.slice(n));
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            tempMatch,
            index,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (!this.options.flex) break;
            }
        }
        if (match) {
            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = {first_line: this.yylloc.last_line,
                           last_line: this.yylineno+1,
                           first_column: this.yylloc.last_column,
                           last_column: lines ? lines[lines.length-1].length-lines[lines.length-1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length};
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
                this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index],this.conditionStack[this.conditionStack.length-1]);
            if (this.done && this._input) this.done = false;
            if (token) return token;
            else return;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(),
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.options = {};
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0: yy_.yytext = "\\"; return 14; 
break;
case 1:
                                   if(yy_.yytext.slice(-1) !== "\\") this.begin("mu");
                                   if(yy_.yytext.slice(-1) === "\\") yy_.yytext = yy_.yytext.substr(0,yy_.yyleng-1), this.begin("emu");
                                   if(yy_.yytext) return 14;
                                 
break;
case 2: return 14; 
break;
case 3:
                                   if(yy_.yytext.slice(-1) !== "\\") this.popState();
                                   if(yy_.yytext.slice(-1) === "\\") yy_.yytext = yy_.yytext.substr(0,yy_.yyleng-1);
                                   return 14;
                                 
break;
case 4: yy_.yytext = yy_.yytext.substr(0, yy_.yyleng-4); this.popState(); return 15; 
break;
case 5: return 25; 
break;
case 6: return 16; 
break;
case 7: return 20; 
break;
case 8: return 19; 
break;
case 9: return 19; 
break;
case 10: return 23; 
break;
case 11: return 22; 
break;
case 12: this.popState(); this.begin('com'); 
break;
case 13: yy_.yytext = yy_.yytext.substr(3,yy_.yyleng-5); this.popState(); return 15; 
break;
case 14: return 22; 
break;
case 15: return 37; 
break;
case 16: return 36; 
break;
case 17: return 36; 
break;
case 18: return 40; 
break;
case 19: /*ignore whitespace*/ 
break;
case 20: this.popState(); return 24; 
break;
case 21: this.popState(); return 18; 
break;
case 22: yy_.yytext = yy_.yytext.substr(1,yy_.yyleng-2).replace(/\\"/g,'"'); return 31; 
break;
case 23: yy_.yytext = yy_.yytext.substr(1,yy_.yyleng-2).replace(/\\'/g,"'"); return 31; 
break;
case 24: return 38; 
break;
case 25: return 33; 
break;
case 26: return 33; 
break;
case 27: return 32; 
break;
case 28: return 36; 
break;
case 29: yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 36; 
break;
case 30: return 'INVALID'; 
break;
case 31: return 5; 
break;
}
};
lexer.rules = [/^(?:\\\\(?=(\{\{)))/,/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:[^\x00]{2,}?(?=(\{\{|$)))/,/^(?:[\s\S]*?--\}\})/,/^(?:\{\{>)/,/^(?:\{\{#)/,/^(?:\{\{\/)/,/^(?:\{\{\^)/,/^(?:\{\{\s*else\b)/,/^(?:\{\{\{)/,/^(?:\{\{&)/,/^(?:\{\{!--)/,/^(?:\{\{![\s\S]*?\}\})/,/^(?:\{\{)/,/^(?:=)/,/^(?:\.(?=[}\/ ]))/,/^(?:\.\.)/,/^(?:[\/.])/,/^(?:\s+)/,/^(?:\}\}\})/,/^(?:\}\})/,/^(?:"(\\["]|[^"])*")/,/^(?:'(\\[']|[^'])*')/,/^(?:@)/,/^(?:true(?=[}\s]))/,/^(?:false(?=[}\s]))/,/^(?:-?[0-9]+(?=[}\s]))/,/^(?:[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.]))/,/^(?:\[[^\]]*\])/,/^(?:.)/,/^(?:$)/];
lexer.conditions = {"mu":{"rules":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31],"inclusive":false},"emu":{"rules":[3],"inclusive":false},"com":{"rules":[4],"inclusive":false},"INITIAL":{"rules":[0,1,2,31],"inclusive":true}};
return lexer;})()
parser.lexer = lexer;
function Parser () { this.yy = {}; }Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();
// END(BROWSER)

module.exports = handlebars;

},{}],27:[function(require,module,exports){
exports.attach = function(Handlebars) {

// BEGIN(BROWSER)

Handlebars.print = function(ast) {
  return new Handlebars.PrintVisitor().accept(ast);
};

Handlebars.PrintVisitor = function() { this.padding = 0; };
Handlebars.PrintVisitor.prototype = new Handlebars.Visitor();

Handlebars.PrintVisitor.prototype.pad = function(string, newline) {
  var out = "";

  for(var i=0,l=this.padding; i<l; i++) {
    out = out + "  ";
  }

  out = out + string;

  if(newline !== false) { out = out + "\n"; }
  return out;
};

Handlebars.PrintVisitor.prototype.program = function(program) {
  var out = "",
      statements = program.statements,
      inverse = program.inverse,
      i, l;

  for(i=0, l=statements.length; i<l; i++) {
    out = out + this.accept(statements[i]);
  }

  this.padding--;

  return out;
};

Handlebars.PrintVisitor.prototype.block = function(block) {
  var out = "";

  out = out + this.pad("BLOCK:");
  this.padding++;
  out = out + this.accept(block.mustache);
  if (block.program) {
    out = out + this.pad("PROGRAM:");
    this.padding++;
    out = out + this.accept(block.program);
    this.padding--;
  }
  if (block.inverse) {
    if (block.program) { this.padding++; }
    out = out + this.pad("{{^}}");
    this.padding++;
    out = out + this.accept(block.inverse);
    this.padding--;
    if (block.program) { this.padding--; }
  }
  this.padding--;

  return out;
};

Handlebars.PrintVisitor.prototype.mustache = function(mustache) {
  var params = mustache.params, paramStrings = [], hash;

  for(var i=0, l=params.length; i<l; i++) {
    paramStrings.push(this.accept(params[i]));
  }

  params = "[" + paramStrings.join(", ") + "]";

  hash = mustache.hash ? " " + this.accept(mustache.hash) : "";

  return this.pad("{{ " + this.accept(mustache.id) + " " + params + hash + " }}");
};

Handlebars.PrintVisitor.prototype.partial = function(partial) {
  var content = this.accept(partial.partialName);
  if(partial.context) { content = content + " " + this.accept(partial.context); }
  return this.pad("{{> " + content + " }}");
};

Handlebars.PrintVisitor.prototype.hash = function(hash) {
  var pairs = hash.pairs;
  var joinedPairs = [], left, right;

  for(var i=0, l=pairs.length; i<l; i++) {
    left = pairs[i][0];
    right = this.accept(pairs[i][1]);
    joinedPairs.push( left + "=" + right );
  }

  return "HASH{" + joinedPairs.join(", ") + "}";
};

Handlebars.PrintVisitor.prototype.STRING = function(string) {
  return '"' + string.string + '"';
};

Handlebars.PrintVisitor.prototype.INTEGER = function(integer) {
  return "INTEGER{" + integer.integer + "}";
};

Handlebars.PrintVisitor.prototype.BOOLEAN = function(bool) {
  return "BOOLEAN{" + bool.bool + "}";
};

Handlebars.PrintVisitor.prototype.ID = function(id) {
  var path = id.parts.join("/");
  if(id.parts.length > 1) {
    return "PATH:" + path;
  } else {
    return "ID:" + path;
  }
};

Handlebars.PrintVisitor.prototype.PARTIAL_NAME = function(partialName) {
    return "PARTIAL:" + partialName.name;
};

Handlebars.PrintVisitor.prototype.DATA = function(data) {
  return "@" + this.accept(data.id);
};

Handlebars.PrintVisitor.prototype.content = function(content) {
  return this.pad("CONTENT[ '" + content.string + "' ]");
};

Handlebars.PrintVisitor.prototype.comment = function(comment) {
  return this.pad("{{! '" + comment.comment + "' }}");
};
// END(BROWSER)

return Handlebars;
};


},{}],28:[function(require,module,exports){
exports.attach = function(Handlebars) {

// BEGIN(BROWSER)

Handlebars.Visitor = function() {};

Handlebars.Visitor.prototype = {
  accept: function(object) {
    return this[object.type](object);
  }
};

// END(BROWSER)

return Handlebars;
};



},{}],29:[function(require,module,exports){
exports.attach = function(Handlebars) {

// BEGIN(BROWSER)

Handlebars.VM = {
  template: function(templateSpec) {
    // Just add water
    var container = {
      escapeExpression: Handlebars.Utils.escapeExpression,
      invokePartial: Handlebars.VM.invokePartial,
      programs: [],
      program: function(i, fn, data) {
        var programWrapper = this.programs[i];
        if(data) {
          programWrapper = Handlebars.VM.program(i, fn, data);
        } else if (!programWrapper) {
          programWrapper = this.programs[i] = Handlebars.VM.program(i, fn);
        }
        return programWrapper;
      },
      merge: function(param, common) {
        var ret = param || common;

        if (param && common) {
          ret = {};
          Handlebars.Utils.extend(ret, common);
          Handlebars.Utils.extend(ret, param);
        }
        return ret;
      },
      programWithDepth: Handlebars.VM.programWithDepth,
      noop: Handlebars.VM.noop,
      compilerInfo: null
    };

    return function(context, options) {
      options = options || {};
      var result = templateSpec.call(container, Handlebars, context, options.helpers, options.partials, options.data);

      var compilerInfo = container.compilerInfo || [],
          compilerRevision = compilerInfo[0] || 1,
          currentRevision = Handlebars.COMPILER_REVISION;

      if (compilerRevision !== currentRevision) {
        if (compilerRevision < currentRevision) {
          var runtimeVersions = Handlebars.REVISION_CHANGES[currentRevision],
              compilerVersions = Handlebars.REVISION_CHANGES[compilerRevision];
          throw "Template was precompiled with an older version of Handlebars than the current runtime. "+
                "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").";
        } else {
          // Use the embedded version info since the runtime doesn't know about this revision yet
          throw "Template was precompiled with a newer version of Handlebars than the current runtime. "+
                "Please update your runtime to a newer version ("+compilerInfo[1]+").";
        }
      }

      return result;
    };
  },

  programWithDepth: function(i, fn, data /*, $depth */) {
    var args = Array.prototype.slice.call(arguments, 3);

    var program = function(context, options) {
      options = options || {};

      return fn.apply(this, [context, options.data || data].concat(args));
    };
    program.program = i;
    program.depth = args.length;
    return program;
  },
  program: function(i, fn, data) {
    var program = function(context, options) {
      options = options || {};

      return fn(context, options.data || data);
    };
    program.program = i;
    program.depth = 0;
    return program;
  },
  noop: function() { return ""; },
  invokePartial: function(partial, name, context, helpers, partials, data) {
    var options = { helpers: helpers, partials: partials, data: data };

    if(partial === undefined) {
      throw new Handlebars.Exception("The partial " + name + " could not be found");
    } else if(partial instanceof Function) {
      return partial(context, options);
    } else if (!Handlebars.compile) {
      throw new Handlebars.Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    } else {
      partials[name] = Handlebars.compile(partial, {data: data !== undefined});
      return partials[name](context, options);
    }
  }
};

Handlebars.template = Handlebars.VM.template;

// END(BROWSER)

return Handlebars;

};

},{}],30:[function(require,module,exports){
exports.attach = function(Handlebars) {

var toString = Object.prototype.toString;

// BEGIN(BROWSER)

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

Handlebars.Exception = function(message) {
  var tmp = Error.prototype.constructor.apply(this, arguments);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }
};
Handlebars.Exception.prototype = new Error();

// Build out our basic SafeString type
Handlebars.SafeString = function(string) {
  this.string = string;
};
Handlebars.SafeString.prototype.toString = function() {
  return this.string.toString();
};

var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

var escapeChar = function(chr) {
  return escape[chr] || "&amp;";
};

Handlebars.Utils = {
  extend: function(obj, value) {
    for(var key in value) {
      if(value.hasOwnProperty(key)) {
        obj[key] = value[key];
      }
    }
  },

  escapeExpression: function(string) {
    // don't escape SafeStrings, since they're already safe
    if (string instanceof Handlebars.SafeString) {
      return string.toString();
    } else if (string == null || string === false) {
      return "";
    }

    // Force a string conversion as this will be done by the append regardless and
    // the regex test will do this transparently behind the scenes, causing issues if
    // an object's to string has escaped characters in it.
    string = string.toString();

    if(!possible.test(string)) { return string; }
    return string.replace(badChars, escapeChar);
  },

  isEmpty: function(value) {
    if (!value && value !== 0) {
      return true;
    } else if(toString.call(value) === "[object Array]" && value.length === 0) {
      return true;
    } else {
      return false;
    }
  }
};

// END(BROWSER)

return Handlebars;
};

},{}],31:[function(require,module,exports){
var Tokenizer = require("./Tokenizer.js");

/*
	Options:
	
	xmlMode: Special behavior for script/style tags (true by default)
	lowerCaseAttributeNames: call .toLowerCase for each attribute name (true if xmlMode is `false`)
	lowerCaseTags: call .toLowerCase for each tag name (true if xmlMode is `false`)
*/

/*
	Callbacks:
	
	oncdataend,
	oncdatastart,
	onclosetag,
	oncomment,
	oncommentend,
	onerror,
	onopentag,
	onprocessinginstruction,
	onreset,
	ontext
*/

var formTags = {
	input: true,
	option: true,
	optgroup: true,
	select: true,
	button: true,
	datalist: true,
	textarea: true
};
var openImpliesClose = {
	tr      : { tr:true, th:true, td:true },
	th      : { th:true },
	td      : { thead:true, td:true },
	body    : { head:true, link:true, script:true },
	li      : { li:true },
	p       : { p:true },
	select  : formTags,
	input   : formTags,
	output  : formTags,
	button  : formTags,
	datalist: formTags,
	textarea: formTags,
	option  : { option:true },
	optgroup: { optgroup:true }
};

var voidElements = {
	__proto__: null,
	area: true,
	base: true,
	basefont: true,
	br: true,
	col: true,
	command: true,
	embed: true,
	frame: true,
	hr: true,
	img: true,
	input: true,
	isindex: true,
	keygen: true,
	link: true,
	meta: true,
	param: true,
	source: true,
	track: true,
	wbr: true
};

function Parser(cbs, options){
	this._options = options || {};
	this._cbs = cbs || {};

	this._tagname = "";
	this._attribname = "";
	this._attribs = null;
	this._stack = [];
	this._done = false;

	this._tokenizer = new Tokenizer(options, this);
}

require("util").inherits(Parser, require("events").EventEmitter);

//Tokenizer event handlers
Parser.prototype.ontext = function(data){
	if(this._cbs.ontext) this._cbs.ontext(data);
};

Parser.prototype.onopentagname = function(name){
	if(!(this._options.xmlMode || "lowerCaseTags" in this._options) || this._options.lowerCaseTags){
		name = name.toLowerCase();
	}

	this._tagname = name;

	if (!this._options.xmlMode && name in openImpliesClose) {
		for(
			var el;
			(el = this._stack[this._stack.length-1]) in openImpliesClose[name];
			this.onclosetag(el)
		);
	}

	if(this._options.xmlMode || !(name in voidElements)){
		this._stack.push(name);
	}

	if(this._cbs.onopentagname) this._cbs.onopentagname(name);
	if(this._cbs.onopentag) this._attribs = {};
};

Parser.prototype.onopentagend = function(){
	if(this._attribname !== "") this.onattribvalue("");
	if(this._attribs){
		if(this._cbs.onopentag) this._cbs.onopentag(this._tagname, this._attribs);
		this._attribs = null;
	}
	if(!this._options.xmlMode && this._cbs.onclosetag && this._tagname in voidElements){
		this._cbs.onclosetag(this._tagname);
	}
	this._tagname = "";
};

Parser.prototype.onclosetag = function(name){
	if(!(this._options.xmlMode || "lowerCaseTags" in this._options) || this._options.lowerCaseTags){
		name = name.toLowerCase();
	}
	if(this._stack.length && (!(name in voidElements) || this._options.xmlMode)){
		var pos = this._stack.lastIndexOf(name);
		if(pos !== -1){
			if(this._cbs.onclosetag){
				pos = this._stack.length - pos;
				while(pos--) this._cbs.onclosetag(this._stack.pop());
			}
			else this._stack.splice(pos);
		} else if(name === "p" && !this._options.xmlMode){
			this.onopentagname(name);
			this.onselfclosingtag();
		}
	} else if(!this._options.xmlMode && (name === "br" || name === "p")){
		this.onopentagname(name);
		this.onselfclosingtag();		
	}
};

Parser.prototype.onselfclosingtag = function(){
	var name = this._tagname;

	this.onopentagend();

	//self-closing tags will be on the top of the stack
	//(cheaper check than in onclosetag)
	if(this._stack[this._stack.length-1] === name){
		if(this._cbs.onclosetag){
			this._cbs.onclosetag(name);
		}
		this._stack.pop();
	}
};

Parser.prototype.onattribname = function(name){
	if(this._attribname !== "") this.onattribvalue("");
	if(!(this._options.xmlMode || "lowerCaseAttributeNames" in this._options) || this._options.lowerCaseAttributeNames){
		name = name.toLowerCase();
	}
	this._attribname = name;
};

Parser.prototype.onattribvalue = function attribValue(value){
	if(this._cbs.onattribute) this._cbs.onattribute(this._attribname, value);
	if(
		this._attribs &&
		!Object.prototype.hasOwnProperty.call(this._attribs, this._attribname)
	){
		this._attribs[this._attribname] = value;
	}
	this._attribname = "";
};

Parser.prototype.ondeclaration = function(value){
	if(this._cbs.onprocessinginstruction){
		var name = value.split(/\s|\//, 1)[0];
		if(!(this._options.xmlMode || "lowerCaseTags" in this._options) || this._options.lowerCaseTags){
			name = name.toLowerCase();
		}
		this._cbs.onprocessinginstruction("!" + name, "!" + value);
	}
};

Parser.prototype.onprocessinginstruction = function(value){
	if(this._cbs.onprocessinginstruction){
		var name = value.split(/\s|\//, 1)[0];
		if(!(this._options.xmlMode || "lowerCaseTags" in this._options) || this._options.lowerCaseTags){
			name = name.toLowerCase();
		}
		this._cbs.onprocessinginstruction("?" + name, "?" + value);
	}
};

Parser.prototype.oncomment = function(value){
	if(this._cbs.oncomment) this._cbs.oncomment(value);
	if(this._cbs.oncommentend) this._cbs.oncommentend();
};

Parser.prototype.oncdata = function(value){
	if(this._options.xmlMode){
		if(this._cbs.oncdatastart) this._cbs.oncdatastart();
		if(this._cbs.ontext) this._cbs.ontext(value);
		if(this._cbs.oncdataend) this._cbs.oncdataend();
	} else {
		this.oncomment("[CDATA[" + value + "]]");
	}
};

Parser.prototype.onerror = function(err){
	if(this._cbs.onerror) this._cbs.onerror(err);
};

Parser.prototype.onend = function(){
	if(this._cbs.onclosetag){
		for(
			var i = this._stack.length;
			i > 0;
			this._cbs.onclosetag(this._stack[--i])
		);
	}
	if(this._cbs.onend) this._cbs.onend();
};


//Resets the parser to a blank state, ready to parse a new HTML document
Parser.prototype.reset = function(){
	if(this._cbs.onreset) this._cbs.onreset();
	this._tokenizer.reset();

	this._tagname = "";
	this._attribname = "";
	this._attribs = null;
	this._stack = [];
	this._done = false;
};

//Parses a complete HTML document and pushes it to the handler
Parser.prototype.parseComplete = function(data){
	this.reset();
	this.end(data);
};

Parser.prototype.write = function(chunk){
	if(this._done) this.onerror(Error(".write() after done!"));
	this._tokenizer.write(chunk);
};

Parser.prototype.end = function(chunk){
	if(this._done) this.onerror(Error(".end() after done!"));
	this._tokenizer.end(chunk);
	this._done = true;
};

//alias for backwards compat
Parser.prototype.parseChunk = Parser.prototype.write;
Parser.prototype.done = Parser.prototype.end;

module.exports = Parser;

},{"./Tokenizer.js":32,"events":17,"util":19}],32:[function(require,module,exports){
module.exports = Tokenizer;

var i = 0,

    TEXT = i++,
    BEFORE_TAG_NAME = i++, //after <
    IN_TAG_NAME = i++,
    BEFORE_CLOSING_TAG_NAME = i++,
    IN_CLOSING_TAG_NAME = i++,
    AFTER_CLOSING_TAG_NAME = i++,

    //attributes
    BEFORE_ATTRIBUTE_NAME = i++,
    IN_ATTRIBUTE_NAME = i++,
    AFTER_ATTRIBUTE_NAME = i++,
    BEFORE_ATTRIBUTE_VALUE = i++,
    IN_ATTRIBUTE_VALUE_DOUBLE_QUOTES = i++, // "
    IN_ATTRIBUTE_VALUE_SINGLE_QUOTES = i++, // '
    IN_ATTRIBUTE_VALUE_NO_QUOTES = i++,

    //declarations
    BEFORE_DECLARATION = i++, // !
    IN_DECLARATION = i++,

    //processing instructions
    IN_PROCESSING_INSTRUCTION = i++, // ?

    //comments
    BEFORE_COMMENT = i++,
    IN_COMMENT = i++,
    AFTER_COMMENT_1 = i++,
    AFTER_COMMENT_2 = i++,

    //cdata
    BEFORE_CDATA_1 = i++, // [
    BEFORE_CDATA_2 = i++, // C
    BEFORE_CDATA_3 = i++, // D
    BEFORE_CDATA_4 = i++, // A
    BEFORE_CDATA_5 = i++, // T
    BEFORE_CDATA_6 = i++, // A
    IN_CDATA = i++,// [
    AFTER_CDATA_1 = i++, // ]
    AFTER_CDATA_2 = i++, // ]

    //special tags
    BEFORE_SPECIAL = i++, //S
    BEFORE_SPECIAL_END = i++,   //S

    BEFORE_SCRIPT_1 = i++, //C
    BEFORE_SCRIPT_2 = i++, //R
    BEFORE_SCRIPT_3 = i++, //I
    BEFORE_SCRIPT_4 = i++, //P
    BEFORE_SCRIPT_5 = i++, //T
    AFTER_SCRIPT_1 = i++, //C
    AFTER_SCRIPT_2 = i++, //R
    AFTER_SCRIPT_3 = i++, //I
    AFTER_SCRIPT_4 = i++, //P
    AFTER_SCRIPT_5 = i++, //T

    BEFORE_STYLE_1 = i++, //T
    BEFORE_STYLE_2 = i++, //Y
    BEFORE_STYLE_3 = i++, //L
    BEFORE_STYLE_4 = i++, //E
    AFTER_STYLE_1 = i++, //T
    AFTER_STYLE_2 = i++, //Y
    AFTER_STYLE_3 = i++, //L
    AFTER_STYLE_4 = i++, //E

    SPECIAL_NONE = 0,
    SPECIAL_SCRIPT = 1,
    SPECIAL_STYLE = 2;


function whitespace(c){
	return c === " " || c === "\n" || c === "\t" || c === "\f";
}

function ifElseState(upper, SUCCESS, FAILURE){
	var lower = upper.toLowerCase();

	if(upper === lower){
		return function(c){
			this._state = c === lower ? SUCCESS : FAILURE;
		};
	} else {
		return function(c){
			this._state = (c === lower || c === upper) ? SUCCESS : FAILURE;
		};
	}
}

function consumeSpecialNameChar(upper, NEXT_STATE){
	var lower = upper.toLowerCase();

	return function(c){
		if(c === lower || c === upper){
			this._state = NEXT_STATE;
		} else {
			this._state = IN_TAG_NAME;
			this._index--; //consume the token again
		}
	};
}

function Tokenizer(options, cbs){
	this._state = TEXT;
	this._buffer = "";
	this._sectionStart = 0;
	this._index = 0;
	this._special = SPECIAL_NONE;
	this._cbs = cbs;
	this._running = true;
	this._xmlMode = !!(options && options.xmlMode);
}

Tokenizer.prototype._stateText = function (c) {
	if(c === "<"){
		if(this._index > this._sectionStart){
			this._cbs.ontext(this._getSection());
		}
		this._state = BEFORE_TAG_NAME;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateBeforeTagName = function (c) {
	if(c === "/"){
		this._state = BEFORE_CLOSING_TAG_NAME;
	} else if(c === ">" || this._special !== SPECIAL_NONE || whitespace(c)) {
		this._state = TEXT;
	} else if(c === "!"){
		this._state = BEFORE_DECLARATION;
		this._sectionStart = this._index + 1;
	} else if(c === "?"){
		this._state = IN_PROCESSING_INSTRUCTION;
		this._sectionStart = this._index + 1;
	} else {
		this._state = (!this._xmlMode && (c === "s" || c === "S")) ?
						BEFORE_SPECIAL : IN_TAG_NAME;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateInTagName = function (c) {
	if(c === "/" || c === ">" || whitespace(c)){
		this._emitToken("onopentagname");
		this._state = BEFORE_ATTRIBUTE_NAME;
		this._index--;
	}
};

Tokenizer.prototype._stateBeforeCloseingTagName = function (c) {
	if(whitespace(c));
	else if(c === ">"){
		this._state = TEXT;
	} else if(this._special !== SPECIAL_NONE){
		if(c === "s" || c === "S"){
			this._state = BEFORE_SPECIAL_END;
		} else {
			this._state = TEXT;
			this._index--;
		}
	} else {
		this._state = IN_CLOSING_TAG_NAME;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateInCloseingTagName = function (c) {
	if(c === ">" || whitespace(c)){
		this._emitToken("onclosetag");
		this._state = AFTER_CLOSING_TAG_NAME;
		this._special = SPECIAL_NONE;
		this._index--;
	}
};

Tokenizer.prototype._stateAfterCloseingTagName = function (c) {
	//skip everything until ">"
	if(c === ">"){
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	}
};

Tokenizer.prototype._stateBeforeAttributeName = function (c) {
	if(whitespace(c)){
		/* noop */
	} else if(c === ">"){
		this._state = TEXT;
		this._cbs.onopentagend();
		this._sectionStart = this._index + 1;
	} else if(c === "/"){
		this._cbs.onselfclosingtag();
		this._state = AFTER_CLOSING_TAG_NAME;
	} else {
		this._state = IN_ATTRIBUTE_NAME;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateInAttributeName = function (c) {
	if(c === "=" || c === "/" || c === ">" || whitespace(c)){
		if(this._index > this._sectionStart){
			this._cbs.onattribname(this._getSection());
		}
		this._sectionStart = -1;
		this._state = AFTER_ATTRIBUTE_NAME;
		this._index--;
	}
};

Tokenizer.prototype._stateAfterAttributeName = function (c) {
	if(c === "="){
		this._state = BEFORE_ATTRIBUTE_VALUE;
	} else if(c === "/" || c === ">"){
		this._state = BEFORE_ATTRIBUTE_NAME;
		this._index--;
	} else if(!whitespace(c)){
		this._state = IN_ATTRIBUTE_NAME;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateBeforeAttributeValue = function (c) {
	if(c === "\""){
		this._state = IN_ATTRIBUTE_VALUE_DOUBLE_QUOTES;
		this._sectionStart = this._index + 1;
	} else if(c === "'"){
		this._state = IN_ATTRIBUTE_VALUE_SINGLE_QUOTES;
		this._sectionStart = this._index + 1;
	} else if(!whitespace(c)){
		this._state = IN_ATTRIBUTE_VALUE_NO_QUOTES;
		this._sectionStart = this._index;
	}
};

Tokenizer.prototype._stateInAttributeValueDoubleQuotes = function (c) {
	if(c === "\""){
		this._emitToken("onattribvalue");
		this._state = BEFORE_ATTRIBUTE_NAME;
	}
};

Tokenizer.prototype._stateInAttributeValueSingleQuotes = function (c) {
	if(c === "'"){
		this._emitToken("onattribvalue");
		this._state = BEFORE_ATTRIBUTE_NAME;
	}
};

Tokenizer.prototype._stateInAttributeValueNoQuotes = function (c) {
	if(whitespace(c) || c === ">"){
		this._emitToken("onattribvalue");
		this._state = BEFORE_ATTRIBUTE_NAME;
		this._index--;
	}
};

Tokenizer.prototype._stateBeforeDeclaration = function (c) {
	this._state = c === "[" ? BEFORE_CDATA_1 :
					c === "-" ? BEFORE_COMMENT :
						IN_DECLARATION;
};

Tokenizer.prototype._stateInDeclaration = function (c) {
	if(c === ">"){
		this._cbs.ondeclaration(this._getSection());
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	}
};

Tokenizer.prototype._stateInProcessingInstruction = function (c) {
	if(c === ">"){
		this._cbs.onprocessinginstruction(this._getSection());
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	}
};

Tokenizer.prototype._stateBeforeComment = function (c) {
	if(c === "-"){
		this._state = IN_COMMENT;
		this._sectionStart = this._index + 1;
	} else {
		this._state = IN_DECLARATION;
	}
};

Tokenizer.prototype._stateInComment = function (c) {
	if(c === "-") this._state = AFTER_COMMENT_1;
};

Tokenizer.prototype._stateAfterComment1 = ifElseState("-", AFTER_COMMENT_2, IN_COMMENT);

Tokenizer.prototype._stateAfterComment2 = function (c) {
	if(c === ">"){
		//remove 2 trailing chars
		this._cbs.oncomment(this._buffer.substring(this._sectionStart, this._index - 2));
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	} else if (c !== "-") {
		this._state = IN_COMMENT;
	}
	// else: stay in AFTER_COMMENT_2 (`--->`)
};

Tokenizer.prototype._stateBeforeCdata1 = ifElseState("C", BEFORE_CDATA_2, IN_DECLARATION);
Tokenizer.prototype._stateBeforeCdata2 = ifElseState("D", BEFORE_CDATA_3, IN_DECLARATION);
Tokenizer.prototype._stateBeforeCdata3 = ifElseState("A", BEFORE_CDATA_4, IN_DECLARATION);
Tokenizer.prototype._stateBeforeCdata4 = ifElseState("T", BEFORE_CDATA_5, IN_DECLARATION);
Tokenizer.prototype._stateBeforeCdata5 = ifElseState("A", BEFORE_CDATA_6, IN_DECLARATION);

Tokenizer.prototype._stateBeforeCdata6 = function (c) {
	if(c === "["){
		this._state = IN_CDATA;
		this._sectionStart = this._index + 1;
	} else {
		this._state = IN_DECLARATION;
	}
};

Tokenizer.prototype._stateInCdata = function (c) {
	if(c === "]") this._state = AFTER_CDATA_1;
};

Tokenizer.prototype._stateAfterCdata1 = ifElseState("]", AFTER_CDATA_2, IN_CDATA);

Tokenizer.prototype._stateAfterCdata2 = function (c) {
	if(c === ">"){
		//remove 2 trailing chars
		this._cbs.oncdata(this._buffer.substring(this._sectionStart, this._index - 2));
		this._state = TEXT;
		this._sectionStart = this._index + 1;
	} else if (c !== "]") {
		this._state = IN_CDATA;
	}
	//else: stay in AFTER_CDATA_2 (`]]]>`)
};

Tokenizer.prototype._stateBeforeSpecial = function (c) {
	if(c === "c" || c === "C"){
		this._state = BEFORE_SCRIPT_1;
	} else if(c === "t" || c === "T"){
		this._state = BEFORE_STYLE_1;
	} else {
		this._state = IN_TAG_NAME;
		this._index--; //consume the token again
	}
};

Tokenizer.prototype._stateBeforeSpecialEnd = function (c) {
	if(this._special === SPECIAL_SCRIPT && (c === "c" || c === "C")){
		this._state = AFTER_SCRIPT_1;
	} else if(this._special === SPECIAL_STYLE && (c === "t" || c === "T")){
		this._state = AFTER_STYLE_1;
	}
	else this._state = TEXT;
};

Tokenizer.prototype._stateBeforeScript1 = consumeSpecialNameChar("R", BEFORE_SCRIPT_2);
Tokenizer.prototype._stateBeforeScript2 = consumeSpecialNameChar("I", BEFORE_SCRIPT_3);
Tokenizer.prototype._stateBeforeScript3 = consumeSpecialNameChar("P", BEFORE_SCRIPT_4);
Tokenizer.prototype._stateBeforeScript4 = consumeSpecialNameChar("T", BEFORE_SCRIPT_5);

Tokenizer.prototype._stateBeforeScript5 = function (c) {
	if(c === "/" || c === ">" || whitespace(c)){
		this._special = SPECIAL_SCRIPT;
	}
	this._state = IN_TAG_NAME;
	this._index--; //consume the token again
};

Tokenizer.prototype._stateAfterScript1 = ifElseState("R", AFTER_SCRIPT_2, TEXT);
Tokenizer.prototype._stateAfterScript2 = ifElseState("I", AFTER_SCRIPT_3, TEXT);
Tokenizer.prototype._stateAfterScript3 = ifElseState("P", AFTER_SCRIPT_4, TEXT);
Tokenizer.prototype._stateAfterScript4 = ifElseState("T", AFTER_SCRIPT_5, TEXT);

Tokenizer.prototype._stateAfterScript5 = function (c) {
	if(c === ">" || whitespace(c)){
		this._state = IN_CLOSING_TAG_NAME;
		this._sectionStart = this._index - 6;
		this._index--; //reconsume the token
	}
	else this._state = TEXT;
};

Tokenizer.prototype._stateBeforeStyle1 = consumeSpecialNameChar("Y", BEFORE_STYLE_2);
Tokenizer.prototype._stateBeforeStyle2 = consumeSpecialNameChar("L", BEFORE_STYLE_3);
Tokenizer.prototype._stateBeforeStyle3 = consumeSpecialNameChar("E", BEFORE_STYLE_4);

Tokenizer.prototype._stateBeforeStyle4 = function (c) {
	if(c === "/" || c === ">" || whitespace(c)){
		this._special = SPECIAL_STYLE;
	}
	this._state = IN_TAG_NAME;
	this._index--; //consume the token again
};

Tokenizer.prototype._stateAfterStyle1 = ifElseState("Y", AFTER_STYLE_2, TEXT);
Tokenizer.prototype._stateAfterStyle2 = ifElseState("L", AFTER_STYLE_3, TEXT);
Tokenizer.prototype._stateAfterStyle3 = ifElseState("E", AFTER_STYLE_4, TEXT);

Tokenizer.prototype._stateAfterStyle4 = function (c) {
	if(c === ">" || whitespace(c)){
		this._state = IN_CLOSING_TAG_NAME;
		this._sectionStart = this._index - 5;
		this._index--; //reconsume the token
	}
	else this._state = TEXT;
};

Tokenizer.prototype._cleanup = function () {
	if(this._sectionStart < 0){
		this._buffer = "";
		this._index = 0;
	} else {
		if(this._state === TEXT){
			if(this._sectionStart !== this._index){
				this._cbs.ontext(this._buffer.substr(this._sectionStart));
			}
			this._buffer = "";
			this._index = 0;
		} else if(this._sectionStart === this._index){
			//the section just started
			this._buffer = "";
			this._index = 0;
		} else {
			//remove everything unnecessary
			this._buffer = this._buffer.substr(this._sectionStart);
			this._index -= this._sectionStart;
		}

		this._sectionStart = 0;
	}
};

//TODO make events conditional
Tokenizer.prototype.write = function(chunk){
	this._buffer += chunk;

	while(this._index < this._buffer.length && this._running){
		var c = this._buffer.charAt(this._index);
		if(this._state === TEXT) {
			this._stateText(c);
		} else if(this._state === BEFORE_TAG_NAME){
			this._stateBeforeTagName(c);
		} else if(this._state === IN_TAG_NAME) {
			this._stateInTagName(c);
		} else if(this._state === BEFORE_CLOSING_TAG_NAME){
			this._stateBeforeCloseingTagName(c);
		} else if(this._state === IN_CLOSING_TAG_NAME){
			this._stateInCloseingTagName(c);
		} else if(this._state === AFTER_CLOSING_TAG_NAME){
			this._stateAfterCloseingTagName(c);
		}

		/*
		*	attributes
		*/
		else if(this._state === BEFORE_ATTRIBUTE_NAME){
			this._stateBeforeAttributeName(c);
		} else if(this._state === IN_ATTRIBUTE_NAME){
			this._stateInAttributeName(c);
		} else if(this._state === AFTER_ATTRIBUTE_NAME){
			this._stateAfterAttributeName(c);
		} else if(this._state === BEFORE_ATTRIBUTE_VALUE){
			this._stateBeforeAttributeValue(c);
		} else if(this._state === IN_ATTRIBUTE_VALUE_DOUBLE_QUOTES){
			this._stateInAttributeValueDoubleQuotes(c);
		} else if(this._state === IN_ATTRIBUTE_VALUE_SINGLE_QUOTES){
			this._stateInAttributeValueSingleQuotes(c);
		} else if(this._state === IN_ATTRIBUTE_VALUE_NO_QUOTES){
			this._stateInAttributeValueNoQuotes(c);
		}

		/*
		*	declarations
		*/
		else if(this._state === BEFORE_DECLARATION){
			this._stateBeforeDeclaration(c);
		} else if(this._state === IN_DECLARATION){
			this._stateInDeclaration(c);
		}

		/*
		*	processing instructions
		*/
		else if(this._state === IN_PROCESSING_INSTRUCTION){
			this._stateInProcessingInstruction(c);
		}

		/*
		*	comments
		*/
		else if(this._state === BEFORE_COMMENT){
			this._stateBeforeComment(c);
		} else if(this._state === IN_COMMENT){
			this._stateInComment(c);
		} else if(this._state === AFTER_COMMENT_1){
			this._stateAfterComment1(c);
		} else if(this._state === AFTER_COMMENT_2){
			this._stateAfterComment2(c);
		}

		/*
		*	cdata
		*/
		else if(this._state === BEFORE_CDATA_1){
			this._stateBeforeCdata1(c);
		} else if(this._state === BEFORE_CDATA_2){
			this._stateBeforeCdata2(c);
		} else if(this._state === BEFORE_CDATA_3){
			this._stateBeforeCdata3(c);
		} else if(this._state === BEFORE_CDATA_4){
			this._stateBeforeCdata4(c);
		} else if(this._state === BEFORE_CDATA_5){
			this._stateBeforeCdata5(c);
		} else if(this._state === BEFORE_CDATA_6){
			this._stateBeforeCdata6(c);
		} else if(this._state === IN_CDATA){
			this._stateInCdata(c);
		} else if(this._state === AFTER_CDATA_1){
			this._stateAfterCdata1(c);
		} else if(this._state === AFTER_CDATA_2){
			this._stateAfterCdata2(c);
		}

		/*
		* special tags
		*/
		else if(this._state === BEFORE_SPECIAL){
			this._stateBeforeSpecial(c);
		} else if(this._state === BEFORE_SPECIAL_END){
			this._stateBeforeSpecialEnd(c);
		}

		/*
		* script
		*/
		else if(this._state === BEFORE_SCRIPT_1){
			this._stateBeforeScript1(c);
		} else if(this._state === BEFORE_SCRIPT_2){
			this._stateBeforeScript2(c);
		} else if(this._state === BEFORE_SCRIPT_3){
			this._stateBeforeScript3(c);
		} else if(this._state === BEFORE_SCRIPT_4){
			this._stateBeforeScript4(c);
		} else if(this._state === BEFORE_SCRIPT_5){
			this._stateBeforeScript5(c);
		}

		else if(this._state === AFTER_SCRIPT_1){
			this._stateAfterScript1(c);
		} else if(this._state === AFTER_SCRIPT_2){
			this._stateAfterScript2(c);
		} else if(this._state === AFTER_SCRIPT_3){
			this._stateAfterScript3(c);
		} else if(this._state === AFTER_SCRIPT_4){
			this._stateAfterScript4(c);
		} else if(this._state === AFTER_SCRIPT_5){
			this._stateAfterScript5(c);
		}

		/*
		* style
		*/
		else if(this._state === BEFORE_STYLE_1){
			this._stateBeforeStyle1(c);
		} else if(this._state === BEFORE_STYLE_2){
			this._stateBeforeStyle2(c);
		} else if(this._state === BEFORE_STYLE_3){
			this._stateBeforeStyle3(c);
		} else if(this._state === BEFORE_STYLE_4){
			this._stateBeforeStyle4(c);
		}

		else if(this._state === AFTER_STYLE_1){
			this._stateAfterStyle1(c);
		} else if(this._state === AFTER_STYLE_2){
			this._stateAfterStyle2(c);
		} else if(this._state === AFTER_STYLE_3){
			this._stateAfterStyle3(c);
		} else if(this._state === AFTER_STYLE_4){
			this._stateAfterStyle4(c);
		}

		else {
			this._cbs.onerror(Error("unknown _state"), this._state);
		}

		this._index++;
	}

	this._cleanup();
};

Tokenizer.prototype.pause = function(){
	this._running = false;
};
Tokenizer.prototype.resume = function(){
	this._running = true;
};

Tokenizer.prototype.end = function(chunk){
	if(chunk) this.write(chunk);

	//if there is remaining data, emit it in a reasonable way
	if(this._sectionStart > this._index){
		var data = this._buffer.substr(this._sectionStart);

		if(this._state === IN_CDATA || this._state === AFTER_CDATA_1 || this._state === AFTER_CDATA_2){
			this._cbs.oncdata(data);
		} else if(this._state === IN_COMMENT || this._state === AFTER_COMMENT_1 || this._state === AFTER_COMMENT_2){
			this._cbs.oncomment(data);
		} else if(this._state === IN_TAG_NAME){
			this._cbs.onopentagname(data);
		} else if(this._state === IN_CLOSING_TAG_NAME){
			this._cbs.onclosetag(data);
		} else {
			this._cbs.ontext(data);
		}
	}

	this._cbs.onend();
};

Tokenizer.prototype.reset = function(){
	Tokenizer.call(this, {xmlMode: this._xmlMode}, this._cbs);
};

Tokenizer.prototype._getSection = function(){
	return this._buffer.substring(this._sectionStart, this._index);
};

Tokenizer.prototype._emitToken = function(name){
	this._cbs[name](this._getSection());
	this._sectionStart = -1;
};

},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvamFja2RlbW8xL1Byb2plY3RzL2RvbWJhcnMvbGliL2RvbWJhcnMuanMiLCIvVXNlcnMvamFja2RlbW8xL1Byb2plY3RzL2RvbWJhcnMvbGliL2RvbWJhcnMvYmFzZS5qcyIsIi9Vc2Vycy9qYWNrZGVtbzEvUHJvamVjdHMvZG9tYmFycy9saWIvZG9tYmFycy9jb21waWxlci9hc3QuanMiLCIvVXNlcnMvamFja2RlbW8xL1Byb2plY3RzL2RvbWJhcnMvbGliL2RvbWJhcnMvY29tcGlsZXIvYmFzZS5qcyIsIi9Vc2Vycy9qYWNrZGVtbzEvUHJvamVjdHMvZG9tYmFycy9saWIvZG9tYmFycy9jb21waWxlci9jb21waWxlcnMvYXR0cmlidXRlcy5qcyIsIi9Vc2Vycy9qYWNrZGVtbzEvUHJvamVjdHMvZG9tYmFycy9saWIvZG9tYmFycy9jb21waWxlci9jb21waWxlcnMvYmFzZS5qcyIsIi9Vc2Vycy9qYWNrZGVtbzEvUHJvamVjdHMvZG9tYmFycy9saWIvZG9tYmFycy9jb21waWxlci9jb21waWxlcnMvY29tbW9uLmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL2xpYi9kb21iYXJzL2NvbXBpbGVyL2NvbXBpbGVycy9qYXZhc2NyaXB0LmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL2xpYi9kb21iYXJzL2NvbXBpbGVyL2luZGV4LmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL2xpYi9kb21iYXJzL2NvbXBpbGVyL3BhcnNlci5qcyIsIi9Vc2Vycy9qYWNrZGVtbzEvUHJvamVjdHMvZG9tYmFycy9saWIvZG9tYmFycy9jb21waWxlci9wcmludGVyLmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL2xpYi9kb21iYXJzL2NvbXBpbGVyL3Zpc2l0b3IuanMiLCIvVXNlcnMvamFja2RlbW8xL1Byb2plY3RzL2RvbWJhcnMvbGliL2RvbWJhcnMvcnVudGltZS5qcyIsIi9Vc2Vycy9qYWNrZGVtbzEvUHJvamVjdHMvZG9tYmFycy9saWIvZG9tYmFycy91dGlscy5qcyIsIi9Vc2Vycy9qYWNrZGVtbzEvUHJvamVjdHMvZG9tYmFycy9ub2RlX21vZHVsZXMvZG9taWZ5L2luZGV4LmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL25vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLWJ1aWx0aW5zL2J1aWx0aW4vX3NoaW1zLmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL25vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLWJ1aWx0aW5zL2J1aWx0aW4vZXZlbnRzLmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL25vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLWJ1aWx0aW5zL2J1aWx0aW4vZnMuanMiLCIvVXNlcnMvamFja2RlbW8xL1Byb2plY3RzL2RvbWJhcnMvbm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItYnVpbHRpbnMvYnVpbHRpbi91dGlsLmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzLmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2Jhc2UuanMiLCIvVXNlcnMvamFja2RlbW8xL1Byb2plY3RzL2RvbWJhcnMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvY29tcGlsZXIvYXN0LmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL2Jhc2UuanMiLCIvVXNlcnMvamFja2RlbW8xL1Byb2plY3RzL2RvbWJhcnMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvY29tcGlsZXIvY29tcGlsZXIuanMiLCIvVXNlcnMvamFja2RlbW8xL1Byb2plY3RzL2RvbWJhcnMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvY29tcGlsZXIvaW5kZXguanMiLCIvVXNlcnMvamFja2RlbW8xL1Byb2plY3RzL2RvbWJhcnMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvY29tcGlsZXIvcGFyc2VyLmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL3ByaW50ZXIuanMiLCIvVXNlcnMvamFja2RlbW8xL1Byb2plY3RzL2RvbWJhcnMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvY29tcGlsZXIvdmlzaXRvci5qcyIsIi9Vc2Vycy9qYWNrZGVtbzEvUHJvamVjdHMvZG9tYmFycy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9ydW50aW1lLmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL3V0aWxzLmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL25vZGVfbW9kdWxlcy9odG1scGFyc2VyMi9saWIvUGFyc2VyLmpzIiwiL1VzZXJzL2phY2tkZW1vMS9Qcm9qZWN0cy9kb21iYXJzL25vZGVfbW9kdWxlcy9odG1scGFyc2VyMi9saWIvVG9rZW5pemVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcE1BO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeE5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9oQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6eENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25lQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgYmFzZSAgICAgPSByZXF1aXJlKCcuL2RvbWJhcnMvYmFzZScpO1xudmFyIGNvbXBpbGVyID0gcmVxdWlyZSgnLi9kb21iYXJzL2NvbXBpbGVyJyk7XG52YXIgdXRpbHMgICAgPSByZXF1aXJlKCcuL2RvbWJhcnMvdXRpbHMnKTtcbnZhciBydW50aW1lICA9IHJlcXVpcmUoJy4vZG9tYmFycy9ydW50aW1lJyk7XG5cbi8qKlxuICogR2VuZXJhdGUgdGhlIGJhc2UgRE9NQmFycyBvYmplY3QuXG4gKlxuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiBjcmVhdGUgKCkge1xuICB2YXIgZGIgPSBiYXNlLmNyZWF0ZSgpO1xuXG4gIHV0aWxzLmF0dGFjaChkYik7XG4gIGNvbXBpbGVyLmF0dGFjaChkYik7XG4gIHJ1bnRpbWUuYXR0YWNoKGRiKTtcblxuICBkYi5jcmVhdGUgPSBjcmVhdGU7XG5cbiAgcmV0dXJuIGRiO1xufSkoKTtcbiIsInZhciBiYXNlID0gcmVxdWlyZSgnaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9iYXNlJyk7XG5cbmV4cG9ydHMuY3JlYXRlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgRE9NQmFycyA9IGJhc2UuY3JlYXRlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgLyoqXG4gICAqIE5vb3AgZnVuY3Rpb25zIGZvciBzdWJzY3JpYmUgYW5kIHVuc3Vic2NyaWJlLiBJbXBsZW1lbnQgeW91ciBvd24gZnVuY3Rpb24uXG4gICAqL1xuICBET01CYXJzLnN1YnNjcmliZSAgPSBET01CYXJzLnVuc3Vic2NyaWJlID0gZnVuY3Rpb24gKCkge307XG4gIERPTUJhcnMuSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hhbmRsZWJhcnMnKTtcblxuICAvKipcbiAgICogQmFzaWMgZ2V0dGVyIGZ1bmN0aW9uLiBBdHRhY2ggdGhpcyBob3dldmVyIHlvdSB3YW50IGl0IHRvIHdvcmsuXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gb2JqZWN0XG4gICAqIEBwYXJhbSAge1N0cmluZ30gcHJvcGVydHlcbiAgICogQHJldHVybiB7Kn1cbiAgICovXG4gIERPTUJhcnMuZ2V0ID0gZnVuY3Rpb24gKG9iamVjdCwgcHJvcGVydHkpIHtcbiAgICByZXR1cm4gb2JqZWN0W3Byb3BlcnR5XTtcbiAgfTtcblxuICAvKipcbiAgICogSGFuZGxlYmFycyBgZWFjaGAgaGVscGVyIGlzIGluY29tcGF0aWJhYmxlIHdpdGggRE9NQmFycywgc2luY2UgaXQgYXNzdW1lc1xuICAgKiBzdHJpbmdzIChhcyBvcHBvc2VkIHRvIGRvY3VtZW50IGZyYWdtZW50cykuXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gY29udGV4dFxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHJldHVybiB7Tm9kZX1cbiAgICovXG4gIERPTUJhcnMucmVnaXN0ZXJIZWxwZXIoJ2VhY2gnLCBmdW5jdGlvbiAoY29udGV4dCwgb3B0aW9ucykge1xuICAgIHZhciBmbiAgICAgID0gb3B0aW9ucy5mbjtcbiAgICB2YXIgaW52ZXJzZSA9IG9wdGlvbnMuZm47XG4gICAgdmFyIGJ1ZmZlciAgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgdmFyIGkgICAgICAgPSAwO1xuICAgIHZhciBkYXRhO1xuXG4gICAgaWYgKHR5cGVvZiBjb250ZXh0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjb250ZXh0ID0gY29udGV4dC5jYWxsKHRoaXMpO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmRhdGEpIHtcbiAgICAgIGRhdGEgPSBET01CYXJzLmNyZWF0ZUZyYW1lKG9wdGlvbnMuZGF0YSk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBjb250ZXh0ID09PSAnb2JqZWN0Jykge1xuICAgICAgdmFyIGxlbiA9IGNvbnRleHQubGVuZ3RoO1xuXG4gICAgICBpZiAobGVuID09PSArbGVuKSB7XG4gICAgICAgIGZvciAoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICBpZiAoZGF0YSkgeyBkYXRhLmluZGV4ID0gaTsgfVxuICAgICAgICAgIGJ1ZmZlci5hcHBlbmRDaGlsZChmbihjb250ZXh0W2ldLCB7IGRhdGE6IGRhdGEgfSkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gY29udGV4dCkge1xuICAgICAgICAgIGlmIChjb250ZXh0Lmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIGkgKz0gMTtcbiAgICAgICAgICAgIGlmIChkYXRhKSB7IGRhdGEua2V5ID0ga2V5OyB9XG4gICAgICAgICAgICBidWZmZXIuYXBwZW5kQ2hpbGQoZm4oY29udGV4dFtrZXldLCB7IGRhdGE6IGRhdGEgfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChpID09PSAwKSB7XG4gICAgICByZXR1cm4gaW52ZXJzZSh0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9KTtcblxuICByZXR1cm4gRE9NQmFycztcbn07XG5cbiIsInZhciBhc3QgPSByZXF1aXJlKCdoYW5kbGViYXJzL2xpYi9oYW5kbGViYXJzL2NvbXBpbGVyL2FzdCcpO1xuXG4vKipcbiAqIEF0dGFjaCB0aGUgQVNUIG9iamVjdCByZXByZXNlbnRhdGlvbnMgdG8gdGhlIERPTUJhcnMgaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtICB7T2JqZWN0fSBET01CYXJzXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMuYXR0YWNoID0gZnVuY3Rpb24gKERPTUJhcnMpIHtcbiAgYXN0LmF0dGFjaChET01CYXJzKTtcblxuICBET01CYXJzLkFTVC5ET00gPSB7XG4gICAgRWxlbWVudDogZnVuY3Rpb24gKG5hbWUsIGF0dHJpYnV0ZXMsIGNvbnRlbnQpIHtcbiAgICAgIHRoaXMudHlwZSAgICAgICA9ICdET01fRUxFTUVOVCc7XG4gICAgICB0aGlzLm5hbWUgICAgICAgPSBuYW1lO1xuICAgICAgdGhpcy5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcztcbiAgICAgIHRoaXMuY29udGVudCAgICA9IGNvbnRlbnQ7XG4gICAgfSxcbiAgICBBdHRyaWJ1dGU6IGZ1bmN0aW9uIChuYW1lLCB2YWx1ZSkge1xuICAgICAgdGhpcy50eXBlICA9ICdET01fQVRUUklCVVRFJztcbiAgICAgIHRoaXMubmFtZSAgPSBuYW1lO1xuICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgIH0sXG4gICAgQ29tbWVudDogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgIHRoaXMudHlwZSA9ICdET01fQ09NTUVOVCc7XG4gICAgICB0aGlzLnRleHQgPSB0ZXh0O1xuICAgIH0sXG4gICAgVGV4dDogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgIHRoaXMudHlwZSA9ICdET01fVEVYVCc7XG4gICAgICB0aGlzLnRleHQgPSB0ZXh0O1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gRE9NQmFycztcbn07XG4iLCJ2YXIgYmFzZSA9IHJlcXVpcmUoJ2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvY29tcGlsZXIvYmFzZScpO1xuXG4vKipcbiAqIEF0dGFjaCB0aGUgYmFzZSBjb21waWxlciBmdW5jdGlvbmFsaXR5IHRvIHRoZSBET01CYXJzIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0gIHtPYmplY3R9IERPTUJhcnNcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZXhwb3J0cy5hdHRhY2ggPSBmdW5jdGlvbiAoRE9NQmFycykge1xuICBiYXNlLmF0dGFjaChET01CYXJzKTtcblxuICBET01CYXJzLlBhcnNlciA9IHJlcXVpcmUoJy4vcGFyc2VyJyk7XG4gIERPTUJhcnMuUGFyc2VyLnl5ID0gRE9NQmFycy5BU1Q7XG5cbiAgRE9NQmFycy5Db21waWxlciAgICAgICAgICAgPSByZXF1aXJlKCcuL2NvbXBpbGVycy9iYXNlJyk7XG4gIERPTUJhcnMuSmF2YVNjcmlwdENvbXBpbGVyID0gcmVxdWlyZSgnLi9jb21waWxlcnMvamF2YXNjcmlwdCcpO1xuXG4gIC8qKlxuICAgKiBDaGVjayB0aGUgYXJndW1lbnRzIHBhc3NlZCBpbnRvIHRoZSBjb21waWxhdGlvbiBmdW5jdGlvbnMgYmVmb3JlIHRyeWluZyB0b1xuICAgKiBjb21waWxlIHRoZSBhcyBhIHByb2dyYW0uXG4gICAqXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmblxuICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICovXG4gIHZhciBjb21waWxlUHJlY2hlY2sgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGlucHV0LCBvcHRpb25zKSB7XG4gICAgICBpZiAodHlwZW9mIGlucHV0ICE9PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIShpbnB1dCBpbnN0YW5jZW9mIERPTUJhcnMuQVNULlByb2dyYW1Ob2RlKSkge1xuICAgICAgICAgIHRocm93IG5ldyBET01CYXJzLkV4Y2VwdGlvbihcbiAgICAgICAgICAgICdZb3UgbXVzdCBwYXNzIGEgc3RyaW5nIG9yIERPTUJhcnMgQVNUIHRvIERPTUJhcnMucHJlY29tcGlsZS4gJyArXG4gICAgICAgICAgICAnWW91IHBhc3NlZCAnICsgaW5wdXRcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgICBpZiAoISgnZGF0YScgaW4gb3B0aW9ucykpIHtcbiAgICAgICAgb3B0aW9ucy5kYXRhID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZuKGlucHV0LCBvcHRpb25zKTtcbiAgICB9O1xuICB9O1xuXG4gIC8qKlxuICAgKiBQcmVjb21waWxlIGdlbmVyYXRlcyBhIHN0cmluZy1iYXNlZCBKYXZhU2NyaXB0IGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IGlucHV0XG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9XG4gICAqL1xuICBET01CYXJzLnByZWNvbXBpbGUgPSBjb21waWxlUHJlY2hlY2soZnVuY3Rpb24gKGlucHV0LCBvcHRpb25zKSB7XG4gICAgdmFyIGFzdCAgICAgICAgID0gRE9NQmFycy5wYXJzZShpbnB1dCk7XG4gICAgdmFyIGVudmlyb25tZW50ID0gbmV3IERPTUJhcnMuQ29tcGlsZXIoKS5jb21waWxlKGFzdCwgb3B0aW9ucyk7XG4gICAgcmV0dXJuIG5ldyBET01CYXJzLkphdmFTY3JpcHRDb21waWxlcigpLmNvbXBpbGUoZW52aXJvbm1lbnQsIG9wdGlvbnMpO1xuICB9KTtcblxuICAvKipcbiAgICogQ29tcGlsYXRpb24gcmV0dXJuIGEgZnVuY3Rpb24gdGhhdCBpcyBpbW1lZGlhdGVseSByZWFkeSBmb3IgZXhlY3V0aW9uIGFzIGFcbiAgICogdGVtcGxhdGUuXG4gICAqXG4gICAqIEBwYXJhbSAge1N0cmluZ30gICBpbnB1dFxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgb3B0aW9uc1xuICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICovXG4gIERPTUJhcnMuY29tcGlsZSA9IGNvbXBpbGVQcmVjaGVjayhmdW5jdGlvbiAoaW5wdXQsIG9wdGlvbnMpIHtcbiAgICB2YXIgY29tcGlsZWQ7XG5cbiAgICB2YXIgY29tcGlsZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBhc3QgICAgICAgICAgPSBET01CYXJzLnBhcnNlKGlucHV0KTtcbiAgICAgIHZhciBlbnZpcm9ubWVudCAgPSBuZXcgRE9NQmFycy5Db21waWxlcigpLmNvbXBpbGUoYXN0LCBvcHRpb25zKTtcbiAgICAgIHZhciB0ZW1wbGF0ZVNwZWMgPSBuZXcgRE9NQmFycy5KYXZhU2NyaXB0Q29tcGlsZXIoKS5jb21waWxlKFxuICAgICAgICBlbnZpcm9ubWVudCwgb3B0aW9ucywgdW5kZWZpbmVkLCB0cnVlXG4gICAgICApO1xuXG4gICAgICByZXR1cm4gRE9NQmFycy50ZW1wbGF0ZSh0ZW1wbGF0ZVNwZWMpO1xuICAgIH07XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICAgIGlmICghY29tcGlsZWQpIHtcbiAgICAgICAgY29tcGlsZWQgPSBjb21waWxlKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBjb21waWxlZC5jYWxsKHRoaXMsIGNvbnRleHQsIG9wdGlvbnMpO1xuICAgIH07XG4gIH0pO1xuXG4gIHJldHVybiBET01CYXJzO1xufTtcbiIsInZhciBIYW5kbGViYXJzICAgICA9IHJlcXVpcmUoJ2hhbmRsZWJhcnMnKTtcbnZhciBDb21tb25Db21waWxlciA9IHJlcXVpcmUoJy4vY29tbW9uJykucHJvdG90eXBlO1xuXG4vKipcbiAqIEF0dHJpYnV0ZSBjb21waWxlci5cbiAqL1xudmFyIENvbXBpbGVyID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7fTtcbkNvbXBpbGVyLnByb3RvdHlwZSA9IEhhbmRsZWJhcnMuY3JlYXRlRnJhbWUoQ29tbW9uQ29tcGlsZXIpO1xuQ29tcGlsZXIucHJvdG90eXBlLmNvbXBpbGVyID0gQ29tcGlsZXI7XG4vKipcbiAqIEFwcGVuZCBjb250ZW50IHRvIHRoZSBjdXJyZW50IGJ1ZmZlci5cbiAqL1xuQ29tcGlsZXIucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zdWJzY3JpYmUoKTtcbiAgQ29tbW9uQ29tcGlsZXIuYXBwZW5kLmNhbGwodGhpcyk7XG59O1xuXG4vKipcbiAqIEFwcGVuZCBlc2NhcGVkIEhhbmRsZWJhcnMgY29udGVudCB0byB0aGUgc291cmNlLlxuICovXG5Db21waWxlci5wcm90b3R5cGUuYXBwZW5kRXNjYXBlZCA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zdWJzY3JpYmUoKTtcbiAgQ29tbW9uQ29tcGlsZXIuYXBwZW5kRXNjYXBlZC5jYWxsKHRoaXMpO1xufTtcblxuIiwidmFyIEhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYW5kbGViYXJzJyk7XG52YXIgSlNDb21waWxlciA9IEhhbmRsZWJhcnMuQ29tcGlsZXIucHJvdG90eXBlO1xuXG4vKipcbiAqIEJhc2UgY29tcGlsZXIgaW4gY2hhcmdlIG9mIGdlbmVyYXRpbmcgYSBjb25zdW1hYmxlIGVudmlyb25tZW50IGZvciB0aGVcbiAqIEphdmFTY3JpcHQgY29tcGlsZXIuXG4gKi9cbnZhciBDb21waWxlciA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge307XG5Db21waWxlci5wcm90b3R5cGUgPSBIYW5kbGViYXJzLmNyZWF0ZUZyYW1lKEpTQ29tcGlsZXIpO1xuQ29tcGlsZXIucHJvdG90eXBlLmNvbXBpbGVyID0gQ29tcGlsZXI7XG5cbi8qKlxuICogQXBwZW5kIGEgRE9NIGVsZW1lbnQgbm9kZSB0byB0aGUgZW52aXJvbm1lbnQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG5vZGVcbiAqL1xuQ29tcGlsZXIucHJvdG90eXBlLkRPTV9FTEVNRU5UID0gZnVuY3Rpb24gKG5vZGUpIHtcbiAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgdGhpcy5jb21waWxlQXR0cmlidXRlKG5vZGUubmFtZSkpO1xuICB0aGlzLm9wY29kZSgnaW52b2tlRWxlbWVudCcpO1xuXG4gIHZhciBuYW1lLCB2YWx1ZTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IG5vZGUuYXR0cmlidXRlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIG5hbWUgID0gdGhpcy5jb21waWxlQXR0cmlidXRlKG5vZGUuYXR0cmlidXRlc1tpXS5uYW1lKTtcbiAgICB2YWx1ZSA9IHRoaXMuY29tcGlsZUF0dHJpYnV0ZShub2RlLmF0dHJpYnV0ZXNbaV0udmFsdWUpO1xuICAgIHRoaXMuYXBwZW5kQXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgfVxuXG4gIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHRoaXMuY29tcGlsZVByb2dyYW0obm9kZS5jb250ZW50KSk7XG4gIHRoaXMub3Bjb2RlKCdpbnZva2VDb250ZW50Jyk7XG4gIHRoaXMub3Bjb2RlKCdhcHBlbmRFbGVtZW50Jyk7XG59O1xuXG4vKipcbiAqIEFwcGVuZCBhIERPTSBjb21tZW50IG5vZGUgdG8gdGhlIGVudmlyb25tZW50LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBub2RlXG4gKi9cbkNvbXBpbGVyLnByb3RvdHlwZS5ET01fQ09NTUVOVCA9IGZ1bmN0aW9uIChub2RlKSB7XG4gIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHRoaXMuY29tcGlsZUF0dHJpYnV0ZShub2RlLnRleHQpKTtcbiAgdGhpcy5vcGNvZGUoJ2ludm9rZUNvbW1lbnQnKTtcbiAgdGhpcy5vcGNvZGUoJ2FwcGVuZEVsZW1lbnQnKTtcbn07XG5cbi8qKlxuICogQXBwZW5kIGEgRE9NIHRleHQgbm9kZSB0byB0aGUgZW52aXJvbm1lbnQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG5vZGVcbiAqL1xuQ29tcGlsZXIucHJvdG90eXBlLkRPTV9URVhUID0gZnVuY3Rpb24gKG5vZGUpIHtcbiAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgdGhpcy5jb21waWxlUHJvZ3JhbShub2RlLnRleHQpKTtcbiAgdGhpcy5vcGNvZGUoJ2FwcGVuZFByb2dyYW0nKTtcbn07XG5cbi8qKlxuICogQXBwZW5kIGFuIGF0dHJpYnV0ZSB0byB0aGUgZW52aXJvbm1lbnQuXG4gKlxuICogQHBhcmFtICB7T2JqZWN0fSBuYW1lXG4gKiBAcGFyYW0gIHtPYmplY3R9IHZhbHVlXG4gKi9cbkNvbXBpbGVyLnByb3RvdHlwZS5hcHBlbmRBdHRyaWJ1dGUgPSBmdW5jdGlvbiAobmFtZSwgdmFsdWUpIHtcbiAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgbmFtZSk7XG4gIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHZhbHVlKTtcbiAgdGhpcy5vcGNvZGUoJ2ludm9rZUF0dHJpYnV0ZScpO1xufTtcblxuLyoqXG4gKiBDb21waWxlIGFuIGF0dHJpYnV0ZSBwcm9ncmFtLlxuICpcbiAqIEBwYXJhbSAge09iamVjdH0gcHJvZ3JhbVxuICogQHJldHVybiB7TnVtYmVyfVxuICovXG5Db21waWxlci5wcm90b3R5cGUuY29tcGlsZUF0dHJpYnV0ZSA9IGZ1bmN0aW9uIChwcm9ncmFtKSB7XG4gIHZhciBndWlkID0gSlNDb21waWxlci5jb21waWxlUHJvZ3JhbS5jYWxsKHRoaXMsIHByb2dyYW0pO1xuICB0aGlzLmNoaWxkcmVuW2d1aWRdLmF0dHJpYnV0ZSA9IHRydWU7XG4gIHJldHVybiBndWlkO1xufTtcblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBiYXNpYyBtdXN0YWNoZSBub2RlLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBtdXN0YWNoZVxuICovXG5Db21waWxlci5wcm90b3R5cGUuc2ltcGxlTXVzdGFjaGUgPSBmdW5jdGlvbiAobXVzdGFjaGUpIHtcbiAgdmFyIGlkID0gbXVzdGFjaGUuaWQ7XG5cbiAgaWYgKGlkLnR5cGUgPT09ICdEQVRBJykge1xuICAgIHRoaXMuREFUQShpZCk7XG4gIH0gZWxzZSBpZiAoaWQucGFydHMubGVuZ3RoKSB7XG4gICAgdGhpcy5JRChpZCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gU2ltcGxpZmllZCBJRCBmb3IgYHRoaXNgLlxuICAgIHRoaXMuYWRkRGVwdGgoaWQuZGVwdGgpO1xuICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgaWQuZGVwdGgpO1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoQ29udGV4dCcpO1xuICAgIHRoaXMub3Bjb2RlKCdsb29rdXBTZWxmJyk7XG4gIH1cblxuICB0aGlzLm9wY29kZSgncmVzb2x2ZVBvc3NpYmxlTGFtYmRhJyk7XG59O1xuIiwidmFyIEhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYW5kbGViYXJzJyk7XG52YXIgSlNDb21waWxlciA9IEhhbmRsZWJhcnMuSmF2YVNjcmlwdENvbXBpbGVyLnByb3RvdHlwZTtcblxuLyoqXG4gKiBDcmVhdGUgdGhlIGJhc2UgY29tcGlsZXIgZnVuY3Rpb25hbGl0eSBhbmQgYXR0YWNoIHJlbGV2YW50IHJlZmVyZW5jZXMuXG4gKi9cbnZhciBDb21waWxlciA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge307XG5Db21waWxlci5wcm90b3R5cGUgPSBIYW5kbGViYXJzLmNyZWF0ZUZyYW1lKEpTQ29tcGlsZXIpO1xuQ29tcGlsZXIucHJvdG90eXBlLmNvbXBpbGVyID0gQ29tcGlsZXI7XG5cbi8qKlxuICogT3ZlcnJpZGUgbmFtZSBsb29rdXAgdG8gdXNlIHRoZSBmdW5jdGlvbiBwcm92aWRlZCBvbiB0aGUgRE9NQmFycyBvYmplY3QuXG4gKlxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5Db21waWxlci5wcm90b3R5cGUubmFtZUxvb2t1cCA9IGZ1bmN0aW9uIChwYXJlbnQsIG5hbWUsIHR5cGUpIHtcbiAgdmFyIHF1b3RlZE5hbWUgPSB0aGlzLnF1b3RlZFN0cmluZyhuYW1lKTtcbiAgdmFyIHF1b3RlZFR5cGUgPSB0aGlzLnF1b3RlZFN0cmluZyh0eXBlKTtcbiAgdGhpcy5jb250ZXh0LmFsaWFzZXMuZ2V0ID0gJ3RoaXMuZ2V0JztcblxuICByZXR1cm4gJ2dldCgnICsgcGFyZW50ICsgJywgJyArIHF1b3RlZE5hbWUgKyAnLCAnICsgcXVvdGVkVHlwZSArICcpJztcbn07XG5cbi8qKlxuICogU3Vic2NyaWJlIHRvIHRoZSBsYXN0IHN1YnNjcmlwdGlvbiBvbiB0aGUgY29udGV4dCBzdGFjay5cbiAqXG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuQ29tcGlsZXIucHJvdG90eXBlLnN1YnNjcmliZSA9IGZ1bmN0aW9uIChmbiwgY291bnQpIHtcbiAgdmFyIHByb2dyYW1OYW1lID0gdGhpcy5xdW90ZWRTdHJpbmcodGhpcy5uYW1lKTtcblxuICBjb3VudCA9IGNvdW50IHx8IDE7XG5cbiAgdGhpcy5jb250ZXh0LmFsaWFzZXMuc3Vic2NyaWJlID0gJ3RoaXMuc3Vic2NyaWJlJztcblxuICB0aGlzLnJlZ2lzdGVyKCdjYicsIGZuID8gJ2Z1bmN0aW9uICh2YWx1ZSkgeycgKyBmbigndmFsdWUnKSArICd9JyA6ICdudWxsJyk7XG5cbiAgd2hpbGUgKGNvdW50LS0pIHtcbiAgICB0aGlzLnNvdXJjZS5wdXNoKCdzdWJzY3JpYmUoJyArIHByb2dyYW1OYW1lICsgJywgY2IpOycpO1xuICB9XG59O1xuXG4vKipcbiAqIFNpbXBsZSBmdW5jdGlvbiBmb3IgbG9va2luZyB1cCByZWZlcmVuY2VzIG9uIGl0c2VsZiBvbmx5LlxuICovXG5Db21waWxlci5wcm90b3R5cGUubG9va3VwU2VsZiA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5yZXBsYWNlU3RhY2soZnVuY3Rpb24oY3VycmVudCkge1xuICAgIHJldHVybiAnZ2V0KCcgKyBjdXJyZW50ICsgJywgbnVsbCwgXCJzZWxmXCIpJztcbiAgfSk7XG59O1xuIiwidmFyIEhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYW5kbGViYXJzJyk7XG52YXIgQ29tbW9uQ29tcGlsZXIgPSByZXF1aXJlKCcuL2NvbW1vbicpLnByb3RvdHlwZTtcblxuLyoqXG4gKiBFeHRlbmRzIEhhbmRsZWJhcnMgSmF2YVNjcmlwdCBjb21waWxlciB0byBhZGQgRE9NIHNwZWNpZmljIHJ1bGVzLlxuICovXG52YXIgQ29tcGlsZXIgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHt9O1xuQ29tcGlsZXIucHJvdG90eXBlID0gSGFuZGxlYmFycy5jcmVhdGVGcmFtZShDb21tb25Db21waWxlcik7XG5Db21waWxlci5wcm90b3R5cGUuY29tcGlsZXIgICAgPSBDb21waWxlcjtcbkNvbXBpbGVyLnByb3RvdHlwZS5hdHRyQ29tcGlsZXIgPSByZXF1aXJlKCcuL2F0dHJpYnV0ZXMnKTtcblxuLyoqXG4gKiBDb21waWxlcyB0aGUgZW52aXJvbm1lbnQgb2JqZWN0IGdlbmVyYXRlZCBieSB0aGUgYmFzZSBjb21waWxlci5cbiAqXG4gKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICAgICAgZW52aXJvbm1lbnRcbiAqIEByZXR1cm4geyhGdW5jdGlvbnxTdHJpbmcpfVxuICovXG5Db21waWxlci5wcm90b3R5cGUuY29tcGlsZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5lbGVtZW50U2xvdCAgICAgICA9IDA7XG4gIHRoaXMuc3Vic2NyaXB0aW9uU3RhY2sgPSBbXTtcblxuICByZXR1cm4gQ29tbW9uQ29tcGlsZXIuY29tcGlsZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuLyoqXG4gKiBDb21waWxlIGFueSBjaGlsZCBwcm9ncmFtIG5vZGVzLiBFLmcuIEJsb2NrIGhlbHBlcnMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGVudmlyb25tZW50XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICovXG5Db21waWxlci5wcm90b3R5cGUuY29tcGlsZUNoaWxkcmVuID0gZnVuY3Rpb24oZW52aXJvbm1lbnQsIG9wdGlvbnMpIHtcbiAgdmFyIGNoaWxkcmVuID0gZW52aXJvbm1lbnQuY2hpbGRyZW47XG4gIHZhciBjaGlsZCwgQ29tcGlsZXIsIHByb2dyYW0sIGluZGV4O1xuXG4gIGZvciAodmFyIGkgPSAwLCBsID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgY2hpbGQgICAgPSBjaGlsZHJlbltpXTtcbiAgICBpbmRleCAgICA9IHRoaXMubWF0Y2hFeGlzdGluZ1Byb2dyYW0oY2hpbGQpO1xuICAgIENvbXBpbGVyID0gdGhpcy5jb21waWxlcjtcblxuICAgIGlmIChjaGlsZC5hdHRyaWJ1dGUpIHtcbiAgICAgIENvbXBpbGVyID0gdGhpcy5hdHRyQ29tcGlsZXI7XG4gICAgfVxuXG4gICAgaWYgKGluZGV4ID09IG51bGwpIHtcbiAgICAgIHRoaXMuY29udGV4dC5wcm9ncmFtcy5wdXNoKCcnKTtcbiAgICAgIGNoaWxkLmluZGV4ID0gaW5kZXggPSB0aGlzLmNvbnRleHQucHJvZ3JhbXMubGVuZ3RoO1xuICAgICAgY2hpbGQubmFtZSAgPSAncHJvZ3JhbScgKyBpbmRleDtcbiAgICAgIHByb2dyYW0gPSBuZXcgQ29tcGlsZXIoKS5jb21waWxlKGNoaWxkLCBvcHRpb25zLCB0aGlzLmNvbnRleHQpO1xuICAgICAgdGhpcy5jb250ZXh0LnByb2dyYW1zW2luZGV4XSAgICAgPSBwcm9ncmFtO1xuICAgICAgdGhpcy5jb250ZXh0LmVudmlyb25tZW50c1tpbmRleF0gPSBjaGlsZDtcbiAgICB9IGVsc2Uge1xuICAgICAgY2hpbGQuaW5kZXggPSBpbmRleDtcbiAgICAgIGNoaWxkLm5hbWUgID0gJ3Byb2dyYW0nICsgaW5kZXg7XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIFB1c2ggYW4gZWxlbWVudCBvbnRvIHRoZSBzdGFjayBhbmQgcmV0dXJuIGl0LlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuQ29tcGlsZXIucHJvdG90eXBlLnB1c2hFbGVtZW50ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gJ2VsZW1lbnQnICsgKCsrdGhpcy5lbGVtZW50U2xvdCk7XG59O1xuXG4vKipcbiAqIFBvcCB0aGUgbGFzdCBlbGVtZW50IG9mZiB0aGUgc3RhY2sgYW5kIHJldHVybiBpdC5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbkNvbXBpbGVyLnByb3RvdHlwZS5wb3BFbGVtZW50ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gJ2VsZW1lbnQnICsgKHRoaXMuZWxlbWVudFNsb3QtLSk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGVsZW1lbnQgYXQgdGhlIGVuZCBvZiB0aGUgc3RhY2suXG4gKlxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5Db21waWxlci5wcm90b3R5cGUudG9wRWxlbWVudCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuICdlbGVtZW50JyArIHRoaXMuZWxlbWVudFNsb3Q7XG59O1xuXG4vKipcbiAqIEFwcGVuZCBzb21lIGNvbnRlbnQgdG8gdGhlIGJ1ZmZlciAoYSBkb2N1bWVudCBmcmFnbWVudCkuXG4gKlxuICogQHBhcmFtICB7U3RyaW5nfSBzdHJpbmdcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuQ29tcGlsZXIucHJvdG90eXBlLmFwcGVuZFRvQnVmZmVyID0gZnVuY3Rpb24gKHN0cmluZykge1xuICBpZiAodGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSkge1xuICAgIHJldHVybiAncmV0dXJuICcgKyBzdHJpbmcgKyAnOyc7XG4gIH1cblxuICB0aGlzLmNvbnRleHQuYWxpYXNlcy5hcHBlbmQgPSAndGhpcy5hcHBlbmRDaGlsZCc7XG5cbiAgcmV0dXJuICdhcHBlbmQoYnVmZmVyLCcgKyBzdHJpbmcgKyAnKTsnO1xufTtcblxuLyoqXG4gKiBJbml0aWFsaXplIHRoZSBiYXNlIHZhbHVlIG9mIHRoZSBidWZmZXIsIGluIHRoaXMgY2FzZSBhIGRvY3VtZW50IGZyYWdtZW50LlxuICpcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuQ29tcGlsZXIucHJvdG90eXBlLmluaXRpYWxpemVCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiAnZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpJztcbn07XG5cbi8qKlxuICogTWVyZ2VzIHRoZSBzb3VyY2UgaW50byBhIHN0cmluZ2lmaWVkIG91dHB1dC5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbkNvbXBpbGVyLnByb3RvdHlwZS5tZXJnZVNvdXJjZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuc291cmNlLmpvaW4oJ1xcbiAgJyk7XG59O1xuXG4vKipcbiAqIEFwcGVuZCBhIHZhcmlhYmxlIHRvIHRoZSBzdGFjay4gQWRkcyBzb21lIGFkZGl0aW9uYWwgbG9naWMgdG8gdHJhbnNmb3JtIHRoZVxuICogdGV4dCBpbnRvIGEgRE9NIG5vZGUgYmVmb3JlIHdlIGF0dGVtcHQgdG8gYXBwZW5kIGl0IHRvIHRoZSBidWZmZXIuXG4gKi9cbkNvbXBpbGVyLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZmx1c2hJbmxpbmUoKTtcbiAgdmFyIGxvY2FsID0gdGhpcy5wb3BTdGFjaygpO1xuXG4gIHRoaXMuY29udGV4dC5hbGlhc2VzLmRvbWlmeSA9ICd0aGlzLmRvbWlmeUV4cHJlc3Npb24nO1xuXG4gIHRoaXMuc291cmNlLnB1c2goJ2lmICgnICsgbG9jYWwgKyAnIHx8ICcgKyBsb2NhbCArICcgPT09IDApIHsnKTtcbiAgdGhpcy5zb3VyY2UucHVzaCgnICAnICsgdGhpcy5hcHBlbmRUb0J1ZmZlcignZG9taWZ5KCcgKyBsb2NhbCArICcpJykpO1xuICB0aGlzLnNvdXJjZS5wdXNoKCd9Jyk7XG5cbiAgaWYgKHRoaXMuZW52aXJvbm1lbnQuaXNTaW1wbGUpIHtcbiAgICB0aGlzLnNvdXJjZS5wdXNoKCdlbHNlIHsgcmV0dXJuICcgKyB0aGlzLmluaXRpYWxpemVCdWZmZXIoKSArICc7IH0nKTtcbiAgfVxufTtcblxuLyoqXG4gKiBBcHBlbmQgYSB0ZXh0IG5vZGUgdG8gdGhlIGJ1ZmZlci5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gY29udGVudFxuICovXG5Db21waWxlci5wcm90b3R5cGUuYXBwZW5kQ29udGVudCA9IGZ1bmN0aW9uIChjb250ZW50KSB7XG4gIHZhciBzdHJpbmcgPSAnZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyArIHRoaXMucXVvdGVkU3RyaW5nKGNvbnRlbnQpICsgJyknO1xuICB0aGlzLnNvdXJjZS5wdXNoKHRoaXMuYXBwZW5kVG9CdWZmZXIoc3RyaW5nKSk7XG59O1xuXG4vKipcbiAqIEFwcGVuZCBhIHByb2dyYW0gbm9kZSB0byB0aGUgc291cmNlLlxuICovXG5Db21waWxlci5wcm90b3R5cGUuYXBwZW5kUHJvZ3JhbSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zb3VyY2UucHVzaCh0aGlzLmFwcGVuZFRvQnVmZmVyKFxuICAgIHRoaXMucG9wU3RhY2soKSArICcoZGVwdGgnICsgdGhpcy5sYXN0Q29udGV4dCArICcpJ1xuICApKTtcbn07XG5cbi8qKlxuICogQXBwZW5kIGFuIGVzY2FwZWQgSGFuZGxlYmFycyBleHByZXNzaW9uIHRvIHRoZSBzb3VyY2UuXG4gKi9cbkNvbXBpbGVyLnByb3RvdHlwZS5hcHBlbmRFc2NhcGVkID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmNvbnRleHQuYWxpYXNlcy50ZXh0aWZ5ICAgICA9ICd0aGlzLnRleHRpZnlFeHByZXNzaW9uJztcbiAgdGhpcy5jb250ZXh0LmFsaWFzZXMucmVwbGFjZU5vZGUgPSAndGhpcy5yZXBsYWNlTm9kZSc7XG5cbiAgdGhpcy5wdXNoU3RhY2soJ3RleHRpZnkoJyArIHRoaXMucG9wU3RhY2soKSArICcpJyk7XG5cbiAgdmFyIHN0YWNrID0gdGhpcy50b3BTdGFjaygpO1xuICB0aGlzLnN1YnNjcmliZShmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gJ3JlcGxhY2VOb2RlKHRleHRpZnkoJyArIHZhbHVlICsgICcpLCAnICsgc3RhY2sgKyAnKTsnO1xuICB9KTtcblxuICB0aGlzLnNvdXJjZS5wdXNoKHRoaXMuYXBwZW5kVG9CdWZmZXIoc3RhY2spKTtcbn07XG5cbi8qKlxuICogQXBwZW5kIGFuIGVsZW1lbnQgbm9kZSB0byB0aGUgc291cmNlLlxuICovXG5Db21waWxlci5wcm90b3R5cGUuYXBwZW5kRWxlbWVudCA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zb3VyY2UucHVzaCh0aGlzLmFwcGVuZFRvQnVmZmVyKHRoaXMucG9wU3RhY2soKSkpO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBET00gY29tbWVudCBub2RlIHJlYWR5IGZvciBhcHBlbmRpbmcgdG8gdGhlIGN1cnJlbnQgYnVmZmVyLlxuICovXG5Db21waWxlci5wcm90b3R5cGUuaW52b2tlQ29tbWVudCA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5yZXBsYWNlU3RhY2soZnVuY3Rpb24gKGN1cnJlbnQpIHtcbiAgICB2YXIgZGVwdGggPSAnZGVwdGgnICsgdGhpcy5sYXN0Q29udGV4dDtcbiAgICByZXR1cm4gJ2RvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJyArIGN1cnJlbnQgKyAnKCcgKyBkZXB0aCArICcpKSc7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBDcmVhdGUgYSBET00gZWxlbWVudCBub2RlIHJlYWR5IGZvciBhcHBlbmRpbmcgdG8gdGhlIGN1cnJlbnQgYnVmZmVyLlxuICovXG5Db21waWxlci5wcm90b3R5cGUuaW52b2tlRWxlbWVudCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGVsZW1lbnQgICAgID0gdGhpcy5wdXNoRWxlbWVudCgpO1xuICB2YXIgY3VycmVudCAgICAgPSB0aGlzLnBvcFN0YWNrKCk7XG4gIHZhciBkZXB0aCAgICAgICA9ICdkZXB0aCcgKyB0aGlzLmxhc3RDb250ZXh0O1xuICB2YXIgZXhlY1Byb2dyYW0gPSAncHJvZ3JhbSgnICsgZGVwdGggKyAnKSc7XG5cbiAgdGhpcy51c2VSZWdpc3RlcihlbGVtZW50KTtcblxuICB0aGlzLmNvbnRleHQuYWxpYXNlcy5zZWxmICAgICAgICA9ICd0aGlzJztcbiAgdGhpcy5jb250ZXh0LmFsaWFzZXMuYXBwZW5kICAgICAgPSAndGhpcy5hcHBlbmRDaGlsZCc7XG4gIHRoaXMuY29udGV4dC5hbGlhc2VzLmNyZWF0ZUVsICAgID0gJ3RoaXMuY3JlYXRlRWxlbWVudCc7XG4gIHRoaXMuY29udGV4dC5hbGlhc2VzLnNldEF0dHIgICAgID0gJ3RoaXMuc2V0QXR0cmlidXRlJztcbiAgdGhpcy5jb250ZXh0LmFsaWFzZXMucmVwbGFjZU5vZGUgPSAndGhpcy5yZXBsYWNlTm9kZSc7XG5cbiAgdGhpcy5zb3VyY2UucHVzaCgnKGZ1bmN0aW9uIChwcm9ncmFtKSB7Jyk7XG5cbiAgdGhpcy5zb3VyY2UucHVzaChlbGVtZW50ICsgJyA9IGNyZWF0ZUVsKCcgKyBleGVjUHJvZ3JhbSArICcpOycpO1xuXG4gIHRoaXMuc291cmNlLnB1c2goXG4gICAgJ3NlbGYub24oXCJjaGFuZ2UgcHJvZ3JhbVwiICsgcHJvZ3JhbS5wcm9ncmFtLCBmdW5jdGlvbiAoKSB7JyArXG4gICAgICAndmFyIG5ld0VsID0gY3JlYXRlRWwoJyArIGV4ZWNQcm9ncmFtICsgJyk7JyArXG4gICAgICAnd2hpbGUgKCcgKyBlbGVtZW50ICsgJy5jaGlsZE5vZGVzLmxlbmd0aCkgeycgK1xuICAgICAgICAnYXBwZW5kKG5ld0VsLCAnICsgZWxlbWVudCArICcuY2hpbGROb2Rlc1swXSk7JyArXG4gICAgICAnfScgK1xuICAgICAgJ2ZvciAoaSA9IDA7IGkgPCAnICsgZWxlbWVudCArICcuYXR0cmlidXRlcy5sZW5ndGg7IGkrKykgeycgK1xuICAgICAgICAndmFyIGF0dHIgPSAnICsgZWxlbWVudCArICcuYXR0cmlidXRlc1tpXTsnICtcbiAgICAgICAgJ3NldEF0dHIobmV3RWwsIGF0dHIubmFtZSwgYXR0ci52YWx1ZSk7JyArXG4gICAgICAnfScgK1xuICAgICAgZWxlbWVudCArICcgPSByZXBsYWNlTm9kZShuZXdFbCwgJyArIGVsZW1lbnQgKyAnKTsnICtcbiAgICAnfSk7J1xuICApO1xuXG4gIHRoaXMuc291cmNlLnB1c2goJ30pKCcgKyBjdXJyZW50ICsgJyk7Jyk7XG5cbiAgdGhpcy5wdXNoKGVsZW1lbnQpO1xufTtcblxuLyoqXG4gKiBBcHBlbmQgYW4gYXR0cmlidXRlIG5vZGUgdG8gdGhlIGN1cnJlbnQgZWxlbWVudC5cbiAqL1xuQ29tcGlsZXIucHJvdG90eXBlLmludm9rZUF0dHJpYnV0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGRlcHRoICAgPSAnZGVwdGgnICsgdGhpcy5sYXN0Q29udGV4dDtcbiAgdmFyIGVsZW1lbnQgPSB0aGlzLnRvcEVsZW1lbnQoKTtcbiAgdmFyIHZhbHVlICAgPSB0aGlzLnBvcFN0YWNrKCk7XG4gIHZhciBuYW1lICAgID0gdGhpcy5wb3BTdGFjaygpO1xuXG4gIHRoaXMuY29udGV4dC5hbGlhc2VzLnNlbGYgICAgICAgPSAndGhpcyc7XG4gIHRoaXMuY29udGV4dC5hbGlhc2VzLnNldEF0dHIgICAgPSAndGhpcy5zZXRBdHRyaWJ1dGUnO1xuICB0aGlzLmNvbnRleHQuYWxpYXNlcy5yZW1vdmVBdHRyID0gJ3RoaXMucmVtb3ZlQXR0cmlidXRlJztcblxuICB2YXIgZXhlY05hbWUgID0gJ25hbWVQcm9ncmFtKCcgKyBkZXB0aCArICcpJztcbiAgdmFyIGV4ZWNWYWx1ZSA9ICd2YWx1ZVByb2dyYW0oJyArIGRlcHRoICsgJyknO1xuXG4gIHRoaXMuc291cmNlLnB1c2goJyhmdW5jdGlvbiAobmFtZVByb2dyYW0sIHZhbHVlUHJvZ3JhbSkgeycpO1xuXG4gIHRoaXMuc291cmNlLnB1c2goJ3ZhciBuYW1lICA9ICcgKyBleGVjTmFtZSk7XG4gIHRoaXMuc291cmNlLnB1c2goJ3ZhciB2YWx1ZSA9ICcgKyBleGVjVmFsdWUpO1xuXG4gIHRoaXMuc291cmNlLnB1c2goJ3NldEF0dHIoJyArIGVsZW1lbnQgKyAnLCBuYW1lLCB2YWx1ZSk7Jyk7XG5cbiAgdGhpcy5zb3VyY2UucHVzaChcbiAgICAnc2VsZi5vbihcImNoYW5nZSBwcm9ncmFtXCIgKyBuYW1lUHJvZ3JhbS5wcm9ncmFtLCBmdW5jdGlvbiAoKSB7JyArXG4gICAgICAncmVtb3ZlQXR0cignICsgZWxlbWVudCArICcsIG5hbWUpOycgK1xuICAgICAgJ3NldEF0dHIoJyArIGVsZW1lbnQgKyAnLCBuYW1lID0gJyArIGV4ZWNOYW1lICsgJywgdmFsdWUpOycgK1xuICAgICd9KTsnXG4gICk7XG5cbiAgdGhpcy5zb3VyY2UucHVzaChcbiAgICAnc2VsZi5vbihcImNoYW5nZSBwcm9ncmFtXCIgKyB2YWx1ZVByb2dyYW0ucHJvZ3JhbSwgZnVuY3Rpb24gKCkgeycgK1xuICAgICAgJ3NldEF0dHIoJyArIGVsZW1lbnQgKyAnLCBuYW1lLCB2YWx1ZSA9ICcgKyBleGVjVmFsdWUgKyAnKTsnICtcbiAgICAnfSk7J1xuICApO1xuXG4gIHRoaXMuc291cmNlLnB1c2goJ30pKCcgKyBuYW1lICsgJywnICsgdmFsdWUgKyAnKTsnKTtcbn07XG5cbi8qKlxuICogSW52b2tlIGFuIGFyYml0cmFyeSBwcm9ncmFtIGFuZCBhcHBlbmQgdG8gdGhlIGN1cnJlbnQgZWxlbWVudC5cbiAqL1xuQ29tcGlsZXIucHJvdG90eXBlLmludm9rZUNvbnRlbnQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBlbGVtZW50ID0gdGhpcy50b3BFbGVtZW50KCk7XG4gIHZhciBkZXB0aCAgID0gJ2RlcHRoJyArIHRoaXMubGFzdENvbnRleHQ7XG5cbiAgdGhpcy5jb250ZXh0LmFsaWFzZXMuYXBwZW5kID0gJ3RoaXMuYXBwZW5kQ2hpbGQnO1xuXG4gIHRoaXMucmVnaXN0ZXIoJ2NoaWxkJywgdGhpcy5wb3BTdGFjaygpICsgJygnICsgZGVwdGggKyAnKScpO1xuXG4gIC8vIENoZWNrIHRoYXQgd2UgaGF2ZSBhIGNoaWxkIG5vZGUgYmVmb3JlIHdlIGF0dGVtcHQgdG8gYXBwZW5kIHRvIHRoZSBET00uXG4gIHRoaXMuc291cmNlLnB1c2goXG4gICAgJ2lmIChjaGlsZCAhPSBudWxsKSB7IGFwcGVuZCgnICsgZWxlbWVudCArICcsY2hpbGQpOyB9J1xuICApO1xufTtcbiIsInZhciBhc3QgICAgID0gcmVxdWlyZSgnLi9hc3QnKTtcbnZhciBiYXNlICAgID0gcmVxdWlyZSgnLi9iYXNlJyk7XG52YXIgcHJpbnRlciA9IHJlcXVpcmUoJy4vcHJpbnRlcicpO1xudmFyIHZpc2l0b3IgPSByZXF1aXJlKCcuL3Zpc2l0b3InKTtcblxuZXhwb3J0cy5hdHRhY2ggPSBmdW5jdGlvbiAoRE9NQmFycykge1xuICB2aXNpdG9yLmF0dGFjaChET01CYXJzKTtcbiAgcHJpbnRlci5hdHRhY2goRE9NQmFycyk7XG4gIGFzdC5hdHRhY2goRE9NQmFycyk7XG4gIGJhc2UuYXR0YWNoKERPTUJhcnMpO1xuXG4gIHJldHVybiBET01CYXJzO1xufTtcbiIsInZhciBIYnNQYXJzZXIgID0gcmVxdWlyZSgnaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9jb21waWxlci9wYXJzZXInKTtcbnZhciBIVE1MUGFyc2VyID0gcmVxdWlyZSgnaHRtbHBhcnNlcjIvbGliL1BhcnNlcicpO1xuXG4vKipcbiAqIFN0cmluZ2lmeSBhbiBgQVNULlByb2dyYW1Ob2RlYCBzbyBpdCBjYW4gYmUgcnVuIHRocm91Z2ggb3RoZXJzIHBhcnNlcnMuIFRoaXNcbiAqIGlzIHJlcXVpcmVkIGZvciB0aGUgbm9kZSB0byBiZSBwYXJzZWQgYXMgSFRNTCAqYWZ0ZXIqIGl0IGlzIHBhcnNlZCBhcyBhXG4gKiBIYW5kbGViYXJzIHRlbXBsYXRlLiBIYW5kbGViYXJzIG11c3QgYWx3YXlzIHJ1biBiZWZvcmUgdGhlIEhUTUwgcGFyc2VyLCBzb1xuICogaXQgY2FuIGNvcnJlY3RseSBtYXRjaCBibG9jayBub2RlcyAoSSBjb3VsZG4ndCBzZWUgYSBzaW1wbGUgd2F5IHRvIHJlc3VtZVxuICogdGhlIGVuZCBibG9jayBub2RlIHBhcnNpbmcpLlxuICpcbiAqIEBwYXJhbSAge0hhbmRsZWJhcnMuQVNULlByb2dyYW1Ob2RlfSBwcm9ncmFtXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbnZhciBzdHJpbmdpZnlQcm9ncmFtID0gZnVuY3Rpb24gKHByb2dyYW0pIHtcbiAgdmFyIGh0bWwgICAgICAgPSAnJztcbiAgdmFyIHN0YXRlbWVudHMgPSBwcm9ncmFtLnN0YXRlbWVudHM7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdGF0ZW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHN0YXRlbWVudCA9IHN0YXRlbWVudHNbaV07XG5cbiAgICBpZiAoc3RhdGVtZW50LnR5cGUgPT09ICdjb250ZW50Jykge1xuICAgICAgaHRtbCArPSBzdGF0ZW1lbnQuc3RyaW5nO1xuICAgIH0gZWxzZSB7XG4gICAgICBodG1sICs9ICd7e2QnICsgaSArICd9fSc7IC8vIFwiQWxpYXNcIiBub2RlXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGh0bWw7XG59O1xuXG4vKipcbiAqIFBhcnNlcyBhIHRleHQgc3RyaW5nIHJldHVybmVkIGZyb20gc3RyaW5naWZ5aW5nIGEgcHJvZ3JhbSBub2RlLiBSZXBsYWNlcyBhbnlcbiAqIG11c3RhY2hlIG5vZGUgcmVmZXJlbmNlcyB3aXRoIHRoZSBvcmlnaW5hbCBub2RlLlxuXG4gKiBAcGFyYW0gIHtTdHJpbmd9IGlucHV0XG4gKiBAcGFyYW0gIHtPYmplY3R9IG9yaWdpbmFsUHJvZ3JhbVxuICogQHJldHVybiB7T2JqZWN0fVxuICovXG52YXIgcGFyc2VQcm9ncmFtID0gZnVuY3Rpb24gKGlucHV0LCBvcmlnaW5hbFByb2dyYW0pIHtcbiAgdmFyIHByb2dyYW0gICAgPSBIYnNQYXJzZXIucGFyc2UoaW5wdXQpO1xuICB2YXIgc3RhdGVtZW50cyA9IHByb2dyYW0uc3RhdGVtZW50cztcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0YXRlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgc3RhdGVtZW50ID0gc3RhdGVtZW50c1tpXTtcblxuICAgIC8vIFJlcGxhY2UgbXVzdGFjaGUgbm9kZXMsIHdoaWNoICpzaG91bGQqIG9ubHkgYmUgcmVhbCBIYW5kbGViYXJzIFwiYWxpYXNcIlxuICAgIC8vIG5vZGVzIHRoYXQgd2VyZSBpbmplY3RlZCBieSB0aGUgc3RyaW5naWZpY2F0aW9uIG9mIHRoZSBwcm9ncmFtIG5vZGUuXG4gICAgaWYgKHN0YXRlbWVudC50eXBlID09PSAnbXVzdGFjaGUnKSB7XG4gICAgICBzdGF0ZW1lbnRzW2ldID0gb3JpZ2luYWxQcm9ncmFtLnN0YXRlbWVudHNbc3RhdGVtZW50LmlkLnN0cmluZy5zdWJzdHIoMSldO1xuICAgICAgc3RhdGVtZW50ID0gc3RhdGVtZW50c1tpXTtcbiAgICB9XG5cbiAgICAvLyBOZWVkIHRvIHJlY3Vyc2l2ZWx5IHJlc29sdmUgYmxvY2sgbm9kZSBwcm9ncmFtcyBhcyBIVE1MLlxuICAgIGlmIChzdGF0ZW1lbnQudHlwZSA9PT0gJ2Jsb2NrJykge1xuICAgICAgaWYgKHN0YXRlbWVudC5wcm9ncmFtKSB7XG4gICAgICAgIHN0YXRlbWVudC5wcm9ncmFtID0gcGFyc2VBc0hUTUwoc3RhdGVtZW50LnByb2dyYW0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdGVtZW50LmludmVyc2UpIHtcbiAgICAgICAgc3RhdGVtZW50LmludmVyc2UgPSBwYXJzZUFzSFRNTChzdGF0ZW1lbnQuaW52ZXJzZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHByb2dyYW07XG59O1xuXG4vKipcbiAqIFBhcnNlIGEgcHJvZ3JhbSBvYmplY3QgYXMgSFRNTCBhbmQgcmV0dXJuIGFuIHVwZGF0ZWQgcHJvZ3JhbS5cbiAqXG4gKiBAcGFyYW0gIHtPYmplY3R9IG9yaWdpbmFsUHJvZ3JhbVxuICogQHJldHVybiB7T2JqZWN0fVxuICovXG52YXIgcGFyc2VBc0hUTUwgPSBmdW5jdGlvbiAob3JpZ2luYWxQcm9ncmFtKSB7XG4gIHZhciB5eSAgID0gSGJzUGFyc2VyLnl5O1xuICB2YXIgaHRtbCA9IHN0cmluZ2lmeVByb2dyYW0ob3JpZ2luYWxQcm9ncmFtKTtcblxuICAvLyBDcmVhdGUgYW5kIHJldHVybiBhIG5ldyBlbXB0eSBwcm9ncmFtIG5vZGUuXG4gIHZhciBuZXdQcm9ncmFtID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBuZXcgeXkuUHJvZ3JhbU5vZGUoW10pO1xuICB9O1xuXG4gIC8vIFN0YXJ0IHRoZSBzdGFjayB3aXRoIGFuIGVtcHR5IHByb2dyYW0gbm9kZSB3aGljaCB3aWxsIGNvbnRhaW4gYWxsIHRoZVxuICAvLyBwYXJzZWQgZWxlbWVudHMuXG4gIHZhciBwcm9ncmFtID0gbmV3UHJvZ3JhbSgpO1xuICB2YXIgc3RhY2sgICA9IFtwcm9ncmFtXTtcbiAgdmFyIGVsZW1lbnQ7XG5cbiAgLy8gR2VuZXJhdGUgYSBuZXcgSFRNTCBwYXJzZXIgaW5zdGFuY2UuXG4gIHZhciBwYXJzZXIgPSBuZXcgSFRNTFBhcnNlcih7XG4gICAgb25vcGVudGFnbmFtZTogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIHZhciBub2RlID0gbmV3IHl5LkRPTS5FbGVtZW50KG5hbWUsIFtdLCBuZXdQcm9ncmFtKCkpO1xuICAgICAgcHJvZ3JhbS5zdGF0ZW1lbnRzLnB1c2gobm9kZSk7XG5cbiAgICAgIC8vIEFsaWFzIHRoZSBjdXJyZW50bHkgYWN0aXZlIHByb2dyYW0gbm9kZSBhbmQgZWxlbWVudC5cbiAgICAgIGVsZW1lbnQgPSBub2RlO1xuICAgICAgc3RhY2sucHVzaChwcm9ncmFtID0gbm9kZS5jb250ZW50KTtcbiAgICB9LFxuICAgIG9uY2xvc2V0YWc6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHN0YWNrLnBvcCgpO1xuICAgICAgZWxlbWVudCA9IG51bGw7XG4gICAgICBwcm9ncmFtID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XG4gICAgfSxcbiAgICBvbmF0dHJpYnV0ZTogZnVuY3Rpb24gKG5hbWUsIHZhbHVlKSB7XG4gICAgICBlbGVtZW50LmF0dHJpYnV0ZXMucHVzaChuZXcgeXkuRE9NLkF0dHJpYnV0ZShuYW1lLCB2YWx1ZSkpO1xuICAgIH0sXG4gICAgb250ZXh0OiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgcHJvZ3JhbS5zdGF0ZW1lbnRzLnB1c2gobmV3IHl5LkRPTS5UZXh0KHRleHQpKTtcbiAgICB9LFxuICAgIG9ucHJvY2Vzc2luZ2luc3RydWN0aW9uOiBmdW5jdGlvbiAoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb2Nlc3NpbmcgaW5zdHJ1Y3Rpb25zIGFyZSBub3Qgc3VwcG9ydGVkIGluIEhUTUwnKTtcbiAgICB9LFxuICAgIG9uY29tbWVudDogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgIHByb2dyYW0uc3RhdGVtZW50cy5wdXNoKG5ldyB5eS5ET00uQ29tbWVudChkYXRhKSk7XG4gICAgfSxcbiAgICBvbmVycm9yOiBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfSk7XG5cbiAgcGFyc2VyLndyaXRlKGh0bWwpO1xuICBwYXJzZXIuZW5kKCk7XG5cbiAgLyoqXG4gICAqIFJlY3Vyc2l2ZWx5IHBhcnNlcyBuZXN0ZWQgRE9NIGVsZW1lbnRzIGFzIEhhbmRsZWJhcnMgdGVtcGxhdGVzLlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHByb2dyYW1cbiAgICogQHBhcmFtICB7T2JqZWN0fSBvcmlnaW5hbFByb2dyYW1cbiAgICogQHJldHVybiB7T2JqZWN0fVxuICAgKi9cbiAgdmFyIGFzdCA9IChmdW5jdGlvbiByZWN1cnNlIChwcm9ncmFtLCBvcmlnaW5hbFByb2dyYW0pIHtcbiAgICB2YXIgc3RhdGVtZW50cyA9IHByb2dyYW0uc3RhdGVtZW50cztcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RhdGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHN0YXRlbWVudCA9IHN0YXRlbWVudHNbaV07XG5cbiAgICAgIGlmIChzdGF0ZW1lbnQudHlwZSA9PT0gJ0RPTV9URVhUJyB8fCBzdGF0ZW1lbnQudHlwZSA9PT0gJ0RPTV9DT01NRU5UJykge1xuICAgICAgICBzdGF0ZW1lbnQudGV4dCA9IHBhcnNlUHJvZ3JhbShzdGF0ZW1lbnQudGV4dCwgb3JpZ2luYWxQcm9ncmFtKTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhdGVtZW50LnR5cGUgPT09ICdET01fRUxFTUVOVCcpIHtcbiAgICAgICAgc3RhdGVtZW50Lm5hbWUgPSBwYXJzZVByb2dyYW0oc3RhdGVtZW50Lm5hbWUsIG9yaWdpbmFsUHJvZ3JhbSk7XG5cbiAgICAgICAgZm9yICh2YXIgayA9IDA7IGsgPCBzdGF0ZW1lbnQuYXR0cmlidXRlcy5sZW5ndGg7IGsrKykge1xuICAgICAgICAgIHZhciBhdHRyaWJ1dGUgPSBzdGF0ZW1lbnQuYXR0cmlidXRlc1trXTtcblxuICAgICAgICAgIGF0dHJpYnV0ZS5uYW1lICA9IHBhcnNlUHJvZ3JhbShhdHRyaWJ1dGUubmFtZSwgIG9yaWdpbmFsUHJvZ3JhbSk7XG4gICAgICAgICAgYXR0cmlidXRlLnZhbHVlID0gcGFyc2VQcm9ncmFtKGF0dHJpYnV0ZS52YWx1ZSwgb3JpZ2luYWxQcm9ncmFtKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlY3Vyc2Uoc3RhdGVtZW50LmNvbnRlbnQsIG9yaWdpbmFsUHJvZ3JhbSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHByb2dyYW07XG4gIH0pKHN0YWNrLnBvcCgpLCBvcmlnaW5hbFByb2dyYW0pO1xuXG4gIHJldHVybiBhc3Q7XG59O1xuXG4vKipcbiAqIFRoZSBwYXJzZXIgaXMgYSBzaW1wbGUgY29uc3RydWN0b3IuIEFsbCB0aGUgZnVuY3Rpb25hbGl0eSBpcyBvbiB0aGUgcHJvdG90eXBlXG4gKiBvYmplY3QuXG4gKi9cbnZhciBQYXJzZXIgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMueXkgPSB7fTtcbn07XG5cbi8qKlxuICogQWxpYXMgdGhlIHBhcnNlciBjb25zdHJ1Y3RvciBmdW5jdGlvbi5cbiAqXG4gKiBAdHlwZSB7RnVuY3Rpb259XG4gKi9cblBhcnNlci5wcm90b3R5cGUuUGFyc2VyID0gUGFyc2VyO1xuXG4vKipcbiAqIFRoZSBwcmltYXJ5IGZ1bmN0aW9uYWxpdHkgb2YgdGhlIHBhcnNlci4gUHVzaGVzIHRoZSBpbnB1dCB0ZXh0IHRocm91Z2hcbiAqIEhhbmRsZWJhcnMgYW5kIGEgSFRNTCBwYXJzZXIsIGdlbmVyYXRpbmcgYSBBU1QgZm9yIHVzZSB3aXRoIHRoZSBjb21waWxlci5cbiAqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IGlucHV0XG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cblBhcnNlci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgSGJzUGFyc2VyLnl5ID0gdGhpcy55eTtcblxuICAvLyBQYXJzZSBpdCBhcyBhIEhhbmRsZWJhcnMgdG8gZXh0cmFjdCB0aGUgaW1wb3J0YW50IG5vZGVzIGZpcnN0LiBUaGVuIHdlXG4gIC8vIHN0cmluZ2lmeSB0aGUgbm9kZSB0byBzb21ldGhpbmcgdGhlIEhUTUwgcGFyc2VyIGNhbiBoYW5kbGUuIFRoZSBBU1QgdGhlXG4gIC8vIEhUTUwgcGFyc2VyIGdlbmVyYXRlcyB3aWxsIGJlIHBhcnNlZCB1c2luZyBIYW5kbGViYXJzIGFnYWluIHRvIGluamVjdCB0aGVcbiAgLy8gb3JpZ2luYWwgbm9kZXMgYmFjay5cbiAgcmV0dXJuIHBhcnNlQXNIVE1MKEhic1BhcnNlci5wYXJzZShpbnB1dCkpO1xufTtcblxuLyoqXG4gKiBFeHBvcnQgYSBzdGF0aWMgaW5zdGFuY2Ugb2YgdGhlIHBhcnNlci5cbiAqXG4gKiBAdHlwZSB7UGFyc2VyfVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IG5ldyBQYXJzZXIoKTtcbiIsInZhciBwcmludGVyID0gcmVxdWlyZSgnaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9jb21waWxlci9wcmludGVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gcHJpbnRlcjtcbiIsInZhciB2aXNpdG9yID0gcmVxdWlyZSgnaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9jb21waWxlci92aXNpdG9yJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gdmlzaXRvcjtcbiIsInZhciBydW50aW1lID0gcmVxdWlyZSgnaGFuZGxlYmFycy9saWIvaGFuZGxlYmFycy9ydW50aW1lJyk7XG5cbi8qKlxuICogQXR0cmlidXRlIHJ1bnRpbWUgZmVhdHVyZXMgdG8gdGhlIERPTUJhcnMgaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtICB7T2JqZWN0fSBET01CYXJzXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMuYXR0YWNoID0gZnVuY3Rpb24oRE9NQmFycykge1xuICBydW50aW1lLmF0dGFjaChET01CYXJzKTtcblxuICAvKipcbiAgICogR2V0IGEgc3BlY2lmaWMgdmFsdWUgdXNpbmcgRE9NQmFycyBiYXNlZCBvbiBkaWZmZXJlbnQgdHlwZXMuXG4gICAqXG4gICAqIEBwYXJhbSAge09iamVjdH0gcGFyZW50XG4gICAqIEBwYXJhbSAge1N0cmluZ30gbmFtZVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHR5cGVcbiAgICogQHJldHVybiB7Kn1cbiAgICovXG4gIHZhciBnZXQgPSBmdW5jdGlvbiAocGFyZW50LCBuYW1lLCB0eXBlKSB7XG4gICAgaWYgKHR5cGUgPT09ICdjb250ZXh0Jykge1xuICAgICAgcmV0dXJuIERPTUJhcnMuZ2V0KHBhcmVudCwgbmFtZSk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGUgPT09ICdzZWxmJykge1xuICAgICAgcmV0dXJuIHBhcmVudDtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyZW50W25hbWVdO1xuICB9O1xuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhbiBleGVjdXRhYmxlIHRlbXBsYXRlIGZyb20gYSB0ZW1wbGF0ZSBzcGVjLlxuICAgKlxuICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgdGVtcGxhdGVTcGVjXG4gICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgKi9cbiAgRE9NQmFycy5WTS50ZW1wbGF0ZSA9IERPTUJhcnMudGVtcGxhdGUgPSBmdW5jdGlvbiAodGVtcGxhdGVTcGVjKSB7XG4gICAgdmFyIERPTUJhcnMgPSB0aGlzO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbnRhaW5lciBvYmplY3QgaG9sZHMgYWxsIHRoZSBmdW5jdGlvbnMgdXNlZCBieSB0aGUgdGVtcGxhdGUgc3BlYy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgdmFyIGNvbnRhaW5lciA9IERPTUJhcnMuY3JlYXRlRnJhbWUoRE9NQmFycy5VdGlscy5FdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuICAgIERPTUJhcnMuVXRpbHMuZXh0ZW5kKGNvbnRhaW5lciwge1xuICAgICAgaXNFbGVtZW50OiAgICAgICAgIERPTUJhcnMuVXRpbHMuaXNFbGVtZW50LFxuICAgICAgYXBwZW5kQ2hpbGQ6ICAgICAgIERPTUJhcnMuVXRpbHMuYXBwZW5kQ2hpbGQsXG4gICAgICByZXBsYWNlTm9kZTogICAgICAgRE9NQmFycy5VdGlscy5yZXBsYWNlTm9kZSxcbiAgICAgIGNyZWF0ZUVsZW1lbnQ6ICAgICBET01CYXJzLlV0aWxzLmNyZWF0ZUVsZW1lbnQsXG4gICAgICBzZXRBdHRyaWJ1dGU6ICAgICAgRE9NQmFycy5VdGlscy5zZXRBdHRyaWJ1dGUsXG4gICAgICByZW1vdmVBdHRyaWJ1dGU6ICAgRE9NQmFycy5VdGlscy5yZW1vdmVBdHRyaWJ1dGUsXG4gICAgICBpbnZva2VQYXJ0aWFsOiAgICAgRE9NQmFycy5WTS5pbnZva2VQYXJ0aWFsLFxuICAgICAgZG9taWZ5RXhwcmVzc2lvbjogIERPTUJhcnMuVXRpbHMuZG9taWZ5RXhwcmVzc2lvbixcbiAgICAgIGVzY2FwZUV4cHJlc3Npb246ICBET01CYXJzLlV0aWxzLmVzY2FwZUV4cHJlc3Npb24sXG4gICAgICB0ZXh0aWZ5RXhwcmVzc2lvbjogRE9NQmFycy5VdGlscy50ZXh0aWZ5RXhwcmVzc2lvbixcbiAgICAgIHByb2dyYW1zOiBbXSxcbiAgICAgIHByb2dyYW06IGZ1bmN0aW9uIChpLCBmbiwgZGF0YSkge1xuICAgICAgICB2YXIgcHJvZ3JhbVdyYXBwZXIgPSB0aGlzLnByb2dyYW1zW2ldO1xuXG4gICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgcmV0dXJuIERPTUJhcnMuVk0ucHJvZ3JhbShpLCBmbiwgZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXByb2dyYW1XcmFwcGVyKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucHJvZ3JhbXNbaV0gPSBET01CYXJzLlZNLnByb2dyYW0oaSwgZm4pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHByb2dyYW1XcmFwcGVyO1xuICAgICAgfSxcbiAgICAgIG1lcmdlOiBmdW5jdGlvbiAocGFyYW0sIGNvbW1vbikge1xuICAgICAgICB2YXIgcmV0ID0gcGFyYW0gfHwgY29tbW9uO1xuXG4gICAgICAgIGlmIChwYXJhbSAmJiBjb21tb24pIHtcbiAgICAgICAgICByZXQgPSB7fTtcbiAgICAgICAgICBET01CYXJzLlV0aWxzLmV4dGVuZChyZXQsIGNvbW1vbik7XG4gICAgICAgICAgRE9NQmFycy5VdGlscy5leHRlbmQocmV0LCBwYXJhbSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgfSxcbiAgICAgIG5vb3A6ICAgICAgICAgICAgIERPTUJhcnMuVk0ubm9vcCxcbiAgICAgIGNvbXBpbGVySW5mbzogICAgIG51bGwsXG4gICAgICBzdWJzY3JpcHRpb25zOiAgICBbXSxcbiAgICAgIHByb2dyYW1XaXRoRGVwdGg6IERPTUJhcnMuVk0ucHJvZ3JhbVdpdGhEZXB0aCxcbiAgICAgIGdldDogZnVuY3Rpb24gKHBhcmVudCwgbmFtZSwgdHlwZSkge1xuICAgICAgICAvLyBQdXNoIGV2ZXJ5IHJlcXVlc3QgaW50byB0aGUgc3Vic2NyaXB0aW9ucyBhcnJheSBhdXRvbWF0aWNhbGx5LlxuICAgICAgICBjb250YWluZXIuc3Vic2NyaXB0aW9ucy5wdXNoKFtwYXJlbnQsIG5hbWUsIHR5cGVdKTtcblxuICAgICAgICByZXR1cm4gZ2V0KHBhcmVudCwgbmFtZSwgdHlwZSk7XG4gICAgICB9LFxuICAgICAgc3Vic2NyaWJlOiBmdW5jdGlvbiAocHJvZ3JhbSwgZm4pIHtcbiAgICAgICAgdmFyIHN1YnNjcmlwdGlvbiA9IGNvbnRhaW5lci5zdWJzY3JpcHRpb25zLnBvcCgpO1xuXG4gICAgICAgIHZhciBwYXJlbnQgPSBzdWJzY3JpcHRpb25bMF07XG4gICAgICAgIHZhciBuYW1lICAgPSBzdWJzY3JpcHRpb25bMV07XG4gICAgICAgIHZhciB0eXBlICAgPSBzdWJzY3JpcHRpb25bMl07XG5cbiAgICAgICAgdmFyIGNiID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNvbnRhaW5lci5lbWl0KCdjaGFuZ2UgJyArIHByb2dyYW0pO1xuXG4gICAgICAgICAgcmV0dXJuIGZuICYmIGZuKGdldChwYXJlbnQsIG5hbWUsIHR5cGUpKTtcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAodHlwZSA9PT0gJ2NvbnRleHQnKSB7XG4gICAgICAgICAgcmV0dXJuIERPTUJhcnMuc3Vic2NyaWJlKHBhcmVudCwgbmFtZSwgY2IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIGNvbXBpbGVkIEphdmFTY3JpcHQgZnVuY3Rpb24gZm9yIGV4ZWN1dGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSAge09iamVjdH0gY29udGV4dFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICAgICAqIEByZXR1cm4ge05vZGV9XG4gICAgICovXG4gICAgcmV0dXJuIGZ1bmN0aW9uIChjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgICAgdmFyIHJlc3VsdCA9IHRlbXBsYXRlU3BlYy5jYWxsKFxuICAgICAgICBjb250YWluZXIsXG4gICAgICAgIERPTUJhcnMsXG4gICAgICAgIGNvbnRleHQsXG4gICAgICAgIG9wdGlvbnMuaGVscGVycyxcbiAgICAgICAgb3B0aW9ucy5wYXJ0aWFscyxcbiAgICAgICAgb3B0aW9ucy5kYXRhXG4gICAgICApO1xuXG4gICAgICB2YXIgY29tcGlsZXJJbmZvICAgICA9IGNvbnRhaW5lci5jb21waWxlckluZm8gfHwgW107XG4gICAgICB2YXIgY29tcGlsZXJSZXZpc2lvbiA9IGNvbXBpbGVySW5mb1swXSB8fCAxO1xuICAgICAgdmFyIGN1cnJlbnRSZXZpc2lvbiAgPSBET01CYXJzLkNPTVBJTEVSX1JFVklTSU9OO1xuXG4gICAgICBpZiAoY29tcGlsZXJSZXZpc2lvbiAhPT0gY3VycmVudFJldmlzaW9uKSB7XG4gICAgICAgIGlmIChjb21waWxlclJldmlzaW9uIDwgY3VycmVudFJldmlzaW9uKSB7XG4gICAgICAgICAgdmFyIHJ1bnRpbWVWZXJzaW9ucyAgPSBET01CYXJzLlJFVklTSU9OX0NIQU5HRVNbY3VycmVudFJldmlzaW9uXTtcbiAgICAgICAgICB2YXIgY29tcGlsZXJWZXJzaW9ucyA9IERPTUJhcnMuUkVWSVNJT05fQ0hBTkdFU1tjb21waWxlclJldmlzaW9uXTtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RlbXBsYXRlIHdhcyBwcmVjb21waWxlZCB3aXRoIGFuIG9sZGVyIHZlcnNpb24gb2YgJyArXG4gICAgICAgICAgICAnRE9NQmFycyB0aGFuIHRoZSBjdXJyZW50IHJ1bnRpbWUuIFBsZWFzZSB1cGRhdGUgeW91ciBwcmVjb21waWxlcicgK1xuICAgICAgICAgICAgJyB0byBhIG5ld2VyIHZlcnNpb24gKCcgKyBydW50aW1lVmVyc2lvbnMgKyAnKSBvciBkb3duZ3JhZGUgeW91ciAnICtcbiAgICAgICAgICAgICdydW50aW1lIHRvIGFuIG9sZGVyIHZlcnNpb24gKCcgKyBjb21waWxlclZlcnNpb25zICsgJykuJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RlbXBsYXRlIHdhcyBwcmVjb21waWxlZCB3aXRoIGEgbmV3ZXIgdmVyc2lvbiBvZicgK1xuICAgICAgICAgICdET01CYXJzIHRoYW4gdGhlIGN1cnJlbnQgcnVudGltZS4gUGxlYXNlIHVwZGF0ZSB5b3VyIHJ1bnRpbWUgdG8gJyArXG4gICAgICAgICAgJ2EgbmV3ZXIgdmVyc2lvbiAoJyArIGNvbXBpbGVySW5mb1sxXSArICcpLicpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgcmV0dXJuIERPTUJhcnM7XG59O1xuIiwidmFyIHV0aWxzICA9IHJlcXVpcmUoJ2hhbmRsZWJhcnMvbGliL2hhbmRsZWJhcnMvdXRpbHMnKTtcbnZhciBkb21pZnkgPSByZXF1aXJlKCdkb21pZnknKTtcblxuLyoqXG4gKiBBdHRhY2ggcmV1c2FibGUgdXRpbGl0eSBmdW5jdGlvbnMgdG8gdGhlIERPTUJhcnMgaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtICB7T2JqZWN0fSBET01CYXJzXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbmV4cG9ydHMuYXR0YWNoID0gZnVuY3Rpb24gKERPTUJhcnMpIHtcbiAgdXRpbHMuYXR0YWNoKERPTUJhcnMpO1xuXG4gIC8qKlxuICAgKiBSZXF1aXJlIGFuIGV2ZW50IGVtaXR0ZXIgY2xhc3MuXG4gICAqXG4gICAqIEB0eXBlIHtPYmplY3R9XG4gICAqL1xuICBET01CYXJzLlV0aWxzLkV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuICAvKipcbiAgICogQ2hlY2sgd2hldGhlciBhbiBvYmplY3QgaXMgYWN0dWFsbHkgYSBET00gbm9kZS5cbiAgICpcbiAgICogQHBhcmFtICB7Kn0gICAgICAgZWxlbWVudFxuICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgKi9cbiAgRE9NQmFycy5VdGlscy5pc0VsZW1lbnQgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgIHJldHVybiBlbGVtZW50IGluc3RhbmNlb2YgTm9kZTtcbiAgfTtcblxuICAvKipcbiAgICogQ3JlYXRlIGFuIGVsZW1lbnQgZnJvbSBhIHRhZyBuYW1lLlxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHRhZ05hbWVcbiAgICogQHJldHVybiB7Tm9kZX1cbiAgICovXG4gIERPTUJhcnMuVXRpbHMuY3JlYXRlRWxlbWVudCA9IGZ1bmN0aW9uICh0YWdOYW1lKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlcGxhY2UgYSBub2RlIGluIHRoZSBET00gd2l0aCBhIG5ldyBub2RlIGFuZCByZXR1cm4gaXQuXG4gICAqXG4gICAqIEBwYXJhbSAge05vZGV9IG5ld05vZGVcbiAgICogQHBhcmFtICB7Tm9kZX0gb2xkTm9kZVxuICAgKiBAcmV0dXJuIHtOb2RlfVxuICAgKi9cbiAgRE9NQmFycy5VdGlscy5yZXBsYWNlTm9kZSA9IGZ1bmN0aW9uIChuZXdOb2RlLCBvbGROb2RlKSB7XG4gICAgb2xkTm9kZS5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCBvbGROb2RlKTtcbiAgICByZXR1cm4gbmV3Tm9kZTtcbiAgfTtcblxuICAvKipcbiAgICogU2V0IGFuIGF0dHJpYnV0ZSB2YWx1ZSBvbiBhbiBlbGVtZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge05vZGV9ICAgZWxlbWVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICAgKiBAcGFyYW0geyp9ICAgICAgdmFsdWVcbiAgICovXG4gIERPTUJhcnMuVXRpbHMuc2V0QXR0cmlidXRlID0gZnVuY3Rpb24gKGVsZW1lbnQsIG5hbWUsIHZhbHVlKSB7XG4gICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW1vdmUgYW4gYXR0cmlidXRlIGZyb20gYW4gZWxlbWVudC5cbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfSAgIGVsZW1lbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAgICovXG4gIERPTUJhcnMuVXRpbHMucmVtb3ZlQXR0cmlidXRlID0gZnVuY3Rpb24gKGVsZW1lbnQsIG5hbWUpIHtcbiAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShuYW1lKTtcbiAgfTtcblxuICAvKipcbiAgICogQXBwZW5kIGEgY2hpbGQgZWxlbWVudCB0byBhIERPTSBub2RlLlxuICAgKlxuICAgKiBAcGFyYW0ge05vZGV9IGVsZW1lbnRcbiAgICogQHBhcmFtIHtOb2RlfSBjaGlsZFxuICAgKi9cbiAgRE9NQmFycy5VdGlscy5hcHBlbmRDaGlsZCA9IGZ1bmN0aW9uIChlbGVtZW50LCBjaGlsZCkge1xuICAgIGVsZW1lbnQuYXBwZW5kQ2hpbGQoY2hpbGQpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUcmFuc2Zvcm0gYSBzdHJpbmcgaW50byBhcmJpdHJhcnkgRE9NIG5vZGVzLlxuICAgKlxuICAgKiBAcGFyYW0gIHtTdHJpbmd9IHN0cmluZ1xuICAgKiBAcmV0dXJuIHtOb2RlfVxuICAgKi9cbiAgRE9NQmFycy5VdGlscy5kb21pZnlFeHByZXNzaW9uID0gZnVuY3Rpb24gKHN0cmluZykge1xuICAgIGlmIChET01CYXJzLlV0aWxzLmlzRWxlbWVudChzdHJpbmcpKSB7XG4gICAgICByZXR1cm4gc3RyaW5nO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZG9taWZ5KHN0cmluZy50b1N0cmluZygpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoc3RyaW5nKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFRyYW5zZm9ybSBhIHN0cmluZyBpbnRvIGEgRE9NIHRleHQgbm9kZSBmb3IgYXBwZW5kaW5nIHRvIHRoZSB0ZW1wbGF0ZS5cbiAgICpcbiAgICogQHBhcmFtICB7U3RyaW5nfSBzdHJpbmdcbiAgICogQHJldHVybiB7VGV4dH1cbiAgICovXG4gIERPTUJhcnMuVXRpbHMudGV4dGlmeUV4cHJlc3Npb24gPSBmdW5jdGlvbiAoc3RyaW5nKSB7XG4gICAgaWYgKHN0cmluZyBpbnN0YW5jZW9mIERPTUJhcnMuU2FmZVN0cmluZykge1xuICAgICAgcmV0dXJuIERPTUJhcnMuVXRpbHMuZG9taWZ5RXhwcmVzc2lvbihzdHJpbmcudG9TdHJpbmcoKSk7XG4gICAgfSBlbHNlIGlmIChzdHJpbmcgPT0gbnVsbCB8fCBzdHJpbmcgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICAgIH1cblxuICAgIC8vIENhdGNoIHdoZW4gdGhlIHN0cmluZyBpcyBhY3R1YWxseSBhIERPTSBub2RlIGFuZCB0dXJuIGl0IGludG8gYSBzdHJpbmcuXG4gICAgaWYgKERPTUJhcnMuVXRpbHMuaXNFbGVtZW50KHN0cmluZykpIHtcbiAgICAgIGlmIChzdHJpbmcub3V0ZXJIVE1MKSB7XG4gICAgICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShzdHJpbmcub3V0ZXJIVE1MKTtcbiAgICAgIH1cblxuICAgICAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgdmFyIG91dGVySFRNTDtcblxuICAgICAgRE9NQmFycy5VdGlscy5hcHBlbmRDaGlsZChkaXYsIHN0cmluZy5jbG9uZU5vZGUodHJ1ZSkpO1xuICAgICAgb3V0ZXJIVE1MID0gZGl2LmlubmVySFRNTDtcbiAgICAgIGRpdiAgICAgICA9IG51bGw7XG5cbiAgICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShvdXRlckhUTUwpO1xuICAgIH1cblxuICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShzdHJpbmcpO1xuICB9O1xuXG4gIHJldHVybiBET01CYXJzO1xufTtcbiIsIlxuLyoqXG4gKiBFeHBvc2UgYHBhcnNlYC5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuXG4vKipcbiAqIFdyYXAgbWFwIGZyb20ganF1ZXJ5LlxuICovXG5cbnZhciBtYXAgPSB7XG4gIG9wdGlvbjogWzEsICc8c2VsZWN0IG11bHRpcGxlPVwibXVsdGlwbGVcIj4nLCAnPC9zZWxlY3Q+J10sXG4gIG9wdGdyb3VwOiBbMSwgJzxzZWxlY3QgbXVsdGlwbGU9XCJtdWx0aXBsZVwiPicsICc8L3NlbGVjdD4nXSxcbiAgbGVnZW5kOiBbMSwgJzxmaWVsZHNldD4nLCAnPC9maWVsZHNldD4nXSxcbiAgdGhlYWQ6IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddLFxuICB0Ym9keTogWzEsICc8dGFibGU+JywgJzwvdGFibGU+J10sXG4gIHRmb290OiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgY29sZ3JvdXA6IFsxLCAnPHRhYmxlPicsICc8L3RhYmxlPiddLFxuICBjYXB0aW9uOiBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXSxcbiAgdHI6IFsyLCAnPHRhYmxlPjx0Ym9keT4nLCAnPC90Ym9keT48L3RhYmxlPiddLFxuICB0ZDogWzMsICc8dGFibGU+PHRib2R5Pjx0cj4nLCAnPC90cj48L3Rib2R5PjwvdGFibGU+J10sXG4gIHRoOiBbMywgJzx0YWJsZT48dGJvZHk+PHRyPicsICc8L3RyPjwvdGJvZHk+PC90YWJsZT4nXSxcbiAgY29sOiBbMiwgJzx0YWJsZT48dGJvZHk+PC90Ym9keT48Y29sZ3JvdXA+JywgJzwvY29sZ3JvdXA+PC90YWJsZT4nXSxcbiAgX2RlZmF1bHQ6IFswLCAnJywgJyddXG59O1xuXG4vKipcbiAqIFBhcnNlIGBodG1sYCBhbmQgcmV0dXJuIHRoZSBjaGlsZHJlbi5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaHRtbFxuICogQHJldHVybiB7QXJyYXl9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBwYXJzZShodG1sKSB7XG4gIGlmICgnc3RyaW5nJyAhPSB0eXBlb2YgaHRtbCkgdGhyb3cgbmV3IFR5cGVFcnJvcignU3RyaW5nIGV4cGVjdGVkJyk7XG5cbiAgLy8gdGFnIG5hbWVcbiAgdmFyIG0gPSAvPChbXFx3Ol0rKS8uZXhlYyhodG1sKTtcbiAgaWYgKCFtKSB0aHJvdyBuZXcgRXJyb3IoJ05vIGVsZW1lbnRzIHdlcmUgZ2VuZXJhdGVkLicpO1xuICB2YXIgdGFnID0gbVsxXTtcblxuICAvLyBib2R5IHN1cHBvcnRcbiAgaWYgKHRhZyA9PSAnYm9keScpIHtcbiAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdodG1sJyk7XG4gICAgZWwuaW5uZXJIVE1MID0gaHRtbDtcbiAgICByZXR1cm4gZWwucmVtb3ZlQ2hpbGQoZWwubGFzdENoaWxkKTtcbiAgfVxuXG4gIC8vIHdyYXAgbWFwXG4gIHZhciB3cmFwID0gbWFwW3RhZ10gfHwgbWFwLl9kZWZhdWx0O1xuICB2YXIgZGVwdGggPSB3cmFwWzBdO1xuICB2YXIgcHJlZml4ID0gd3JhcFsxXTtcbiAgdmFyIHN1ZmZpeCA9IHdyYXBbMl07XG4gIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBlbC5pbm5lckhUTUwgPSBwcmVmaXggKyBodG1sICsgc3VmZml4O1xuICB3aGlsZSAoZGVwdGgtLSkgZWwgPSBlbC5sYXN0Q2hpbGQ7XG5cbiAgdmFyIGVscyA9IGVsLmNoaWxkcmVuO1xuICBpZiAoMSA9PSBlbHMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGVsLnJlbW92ZUNoaWxkKGVsc1swXSk7XG4gIH1cblxuICB2YXIgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gIHdoaWxlIChlbHMubGVuZ3RoKSB7XG4gICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZWwucmVtb3ZlQ2hpbGQoZWxzWzBdKSk7XG4gIH1cblxuICByZXR1cm4gZnJhZ21lbnQ7XG59XG4iLCJcblxuLy9cbi8vIFRoZSBzaGltcyBpbiB0aGlzIGZpbGUgYXJlIG5vdCBmdWxseSBpbXBsZW1lbnRlZCBzaGltcyBmb3IgdGhlIEVTNVxuLy8gZmVhdHVyZXMsIGJ1dCBkbyB3b3JrIGZvciB0aGUgcGFydGljdWxhciB1c2VjYXNlcyB0aGVyZSBpcyBpblxuLy8gdGhlIG90aGVyIG1vZHVsZXMuXG4vL1xuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLy8gQXJyYXkuaXNBcnJheSBpcyBzdXBwb3J0ZWQgaW4gSUU5XG5mdW5jdGlvbiBpc0FycmF5KHhzKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn1cbmV4cG9ydHMuaXNBcnJheSA9IHR5cGVvZiBBcnJheS5pc0FycmF5ID09PSAnZnVuY3Rpb24nID8gQXJyYXkuaXNBcnJheSA6IGlzQXJyYXk7XG5cbi8vIEFycmF5LnByb3RvdHlwZS5pbmRleE9mIGlzIHN1cHBvcnRlZCBpbiBJRTlcbmV4cG9ydHMuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YoeHMsIHgpIHtcbiAgaWYgKHhzLmluZGV4T2YpIHJldHVybiB4cy5pbmRleE9mKHgpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHggPT09IHhzW2ldKSByZXR1cm4gaTtcbiAgfVxuICByZXR1cm4gLTE7XG59O1xuXG4vLyBBcnJheS5wcm90b3R5cGUuZmlsdGVyIGlzIHN1cHBvcnRlZCBpbiBJRTlcbmV4cG9ydHMuZmlsdGVyID0gZnVuY3Rpb24gZmlsdGVyKHhzLCBmbikge1xuICBpZiAoeHMuZmlsdGVyKSByZXR1cm4geHMuZmlsdGVyKGZuKTtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGZuKHhzW2ldLCBpLCB4cykpIHJlcy5wdXNoKHhzW2ldKTtcbiAgfVxuICByZXR1cm4gcmVzO1xufTtcblxuLy8gQXJyYXkucHJvdG90eXBlLmZvckVhY2ggaXMgc3VwcG9ydGVkIGluIElFOVxuZXhwb3J0cy5mb3JFYWNoID0gZnVuY3Rpb24gZm9yRWFjaCh4cywgZm4sIHNlbGYpIHtcbiAgaWYgKHhzLmZvckVhY2gpIHJldHVybiB4cy5mb3JFYWNoKGZuLCBzZWxmKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgIGZuLmNhbGwoc2VsZiwgeHNbaV0sIGksIHhzKTtcbiAgfVxufTtcblxuLy8gQXJyYXkucHJvdG90eXBlLm1hcCBpcyBzdXBwb3J0ZWQgaW4gSUU5XG5leHBvcnRzLm1hcCA9IGZ1bmN0aW9uIG1hcCh4cywgZm4pIHtcbiAgaWYgKHhzLm1hcCkgcmV0dXJuIHhzLm1hcChmbik7XG4gIHZhciBvdXQgPSBuZXcgQXJyYXkoeHMubGVuZ3RoKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgIG91dFtpXSA9IGZuKHhzW2ldLCBpLCB4cyk7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn07XG5cbi8vIEFycmF5LnByb3RvdHlwZS5yZWR1Y2UgaXMgc3VwcG9ydGVkIGluIElFOVxuZXhwb3J0cy5yZWR1Y2UgPSBmdW5jdGlvbiByZWR1Y2UoYXJyYXksIGNhbGxiYWNrLCBvcHRfaW5pdGlhbFZhbHVlKSB7XG4gIGlmIChhcnJheS5yZWR1Y2UpIHJldHVybiBhcnJheS5yZWR1Y2UoY2FsbGJhY2ssIG9wdF9pbml0aWFsVmFsdWUpO1xuICB2YXIgdmFsdWUsIGlzVmFsdWVTZXQgPSBmYWxzZTtcblxuICBpZiAoMiA8IGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICB2YWx1ZSA9IG9wdF9pbml0aWFsVmFsdWU7XG4gICAgaXNWYWx1ZVNldCA9IHRydWU7XG4gIH1cbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcnJheS5sZW5ndGg7IGwgPiBpOyArK2kpIHtcbiAgICBpZiAoYXJyYXkuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgIGlmIChpc1ZhbHVlU2V0KSB7XG4gICAgICAgIHZhbHVlID0gY2FsbGJhY2sodmFsdWUsIGFycmF5W2ldLCBpLCBhcnJheSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdmFsdWUgPSBhcnJheVtpXTtcbiAgICAgICAgaXNWYWx1ZVNldCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHZhbHVlO1xufTtcblxuLy8gU3RyaW5nLnByb3RvdHlwZS5zdWJzdHIgLSBuZWdhdGl2ZSBpbmRleCBkb24ndCB3b3JrIGluIElFOFxuaWYgKCdhYicuc3Vic3RyKC0xKSAhPT0gJ2InKSB7XG4gIGV4cG9ydHMuc3Vic3RyID0gZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbmd0aCkge1xuICAgIC8vIGRpZCB3ZSBnZXQgYSBuZWdhdGl2ZSBzdGFydCwgY2FsY3VsYXRlIGhvdyBtdWNoIGl0IGlzIGZyb20gdGhlIGJlZ2lubmluZyBvZiB0aGUgc3RyaW5nXG4gICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSBzdHIubGVuZ3RoICsgc3RhcnQ7XG5cbiAgICAvLyBjYWxsIHRoZSBvcmlnaW5hbCBmdW5jdGlvblxuICAgIHJldHVybiBzdHIuc3Vic3RyKHN0YXJ0LCBsZW5ndGgpO1xuICB9O1xufSBlbHNlIHtcbiAgZXhwb3J0cy5zdWJzdHIgPSBmdW5jdGlvbiAoc3RyLCBzdGFydCwgbGVuZ3RoKSB7XG4gICAgcmV0dXJuIHN0ci5zdWJzdHIoc3RhcnQsIGxlbmd0aCk7XG4gIH07XG59XG5cbi8vIFN0cmluZy5wcm90b3R5cGUudHJpbSBpcyBzdXBwb3J0ZWQgaW4gSUU5XG5leHBvcnRzLnRyaW0gPSBmdW5jdGlvbiAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKCk7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpO1xufTtcblxuLy8gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQgaXMgc3VwcG9ydGVkIGluIElFOVxuZXhwb3J0cy5iaW5kID0gZnVuY3Rpb24gKCkge1xuICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gIHZhciBmbiA9IGFyZ3Muc2hpZnQoKTtcbiAgaWYgKGZuLmJpbmQpIHJldHVybiBmbi5iaW5kLmFwcGx5KGZuLCBhcmdzKTtcbiAgdmFyIHNlbGYgPSBhcmdzLnNoaWZ0KCk7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgZm4uYXBwbHkoc2VsZiwgYXJncy5jb25jYXQoW0FycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyldKSk7XG4gIH07XG59O1xuXG4vLyBPYmplY3QuY3JlYXRlIGlzIHN1cHBvcnRlZCBpbiBJRTlcbmZ1bmN0aW9uIGNyZWF0ZShwcm90b3R5cGUsIHByb3BlcnRpZXMpIHtcbiAgdmFyIG9iamVjdDtcbiAgaWYgKHByb3RvdHlwZSA9PT0gbnVsbCkge1xuICAgIG9iamVjdCA9IHsgJ19fcHJvdG9fXycgOiBudWxsIH07XG4gIH1cbiAgZWxzZSB7XG4gICAgaWYgKHR5cGVvZiBwcm90b3R5cGUgIT09ICdvYmplY3QnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAndHlwZW9mIHByb3RvdHlwZVsnICsgKHR5cGVvZiBwcm90b3R5cGUpICsgJ10gIT0gXFwnb2JqZWN0XFwnJ1xuICAgICAgKTtcbiAgICB9XG4gICAgdmFyIFR5cGUgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICBUeXBlLnByb3RvdHlwZSA9IHByb3RvdHlwZTtcbiAgICBvYmplY3QgPSBuZXcgVHlwZSgpO1xuICAgIG9iamVjdC5fX3Byb3RvX18gPSBwcm90b3R5cGU7XG4gIH1cbiAgaWYgKHR5cGVvZiBwcm9wZXJ0aWVzICE9PSAndW5kZWZpbmVkJyAmJiBPYmplY3QuZGVmaW5lUHJvcGVydGllcykge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKG9iamVjdCwgcHJvcGVydGllcyk7XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cbmV4cG9ydHMuY3JlYXRlID0gdHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICdmdW5jdGlvbicgPyBPYmplY3QuY3JlYXRlIDogY3JlYXRlO1xuXG4vLyBPYmplY3Qua2V5cyBhbmQgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgaXMgc3VwcG9ydGVkIGluIElFOSBob3dldmVyXG4vLyB0aGV5IGRvIHNob3cgYSBkZXNjcmlwdGlvbiBhbmQgbnVtYmVyIHByb3BlcnR5IG9uIEVycm9yIG9iamVjdHNcbmZ1bmN0aW9uIG5vdE9iamVjdChvYmplY3QpIHtcbiAgcmV0dXJuICgodHlwZW9mIG9iamVjdCAhPSBcIm9iamVjdFwiICYmIHR5cGVvZiBvYmplY3QgIT0gXCJmdW5jdGlvblwiKSB8fCBvYmplY3QgPT09IG51bGwpO1xufVxuXG5mdW5jdGlvbiBrZXlzU2hpbShvYmplY3QpIHtcbiAgaWYgKG5vdE9iamVjdChvYmplY3QpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5rZXlzIGNhbGxlZCBvbiBhIG5vbi1vYmplY3RcIik7XG4gIH1cblxuICB2YXIgcmVzdWx0ID0gW107XG4gIGZvciAodmFyIG5hbWUgaW4gb2JqZWN0KSB7XG4gICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBuYW1lKSkge1xuICAgICAgcmVzdWx0LnB1c2gobmFtZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIGdldE93blByb3BlcnR5TmFtZXMgaXMgYWxtb3N0IHRoZSBzYW1lIGFzIE9iamVjdC5rZXlzIG9uZSBrZXkgZmVhdHVyZVxuLy8gIGlzIHRoYXQgaXQgcmV0dXJucyBoaWRkZW4gcHJvcGVydGllcywgc2luY2UgdGhhdCBjYW4ndCBiZSBpbXBsZW1lbnRlZCxcbi8vICB0aGlzIGZlYXR1cmUgZ2V0cyByZWR1Y2VkIHNvIGl0IGp1c3Qgc2hvd3MgdGhlIGxlbmd0aCBwcm9wZXJ0eSBvbiBhcnJheXNcbmZ1bmN0aW9uIHByb3BlcnR5U2hpbShvYmplY3QpIHtcbiAgaWYgKG5vdE9iamVjdChvYmplY3QpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzIGNhbGxlZCBvbiBhIG5vbi1vYmplY3RcIik7XG4gIH1cblxuICB2YXIgcmVzdWx0ID0ga2V5c1NoaW0ob2JqZWN0KTtcbiAgaWYgKGV4cG9ydHMuaXNBcnJheShvYmplY3QpICYmIGV4cG9ydHMuaW5kZXhPZihvYmplY3QsICdsZW5ndGgnKSA9PT0gLTEpIHtcbiAgICByZXN1bHQucHVzaCgnbGVuZ3RoJyk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxudmFyIGtleXMgPSB0eXBlb2YgT2JqZWN0LmtleXMgPT09ICdmdW5jdGlvbicgPyBPYmplY3Qua2V5cyA6IGtleXNTaGltO1xudmFyIGdldE93blByb3BlcnR5TmFtZXMgPSB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgPT09ICdmdW5jdGlvbicgP1xuICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyA6IHByb3BlcnR5U2hpbTtcblxuaWYgKG5ldyBFcnJvcigpLmhhc093blByb3BlcnR5KCdkZXNjcmlwdGlvbicpKSB7XG4gIHZhciBFUlJPUl9QUk9QRVJUWV9GSUxURVIgPSBmdW5jdGlvbiAob2JqLCBhcnJheSkge1xuICAgIGlmICh0b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEVycm9yXScpIHtcbiAgICAgIGFycmF5ID0gZXhwb3J0cy5maWx0ZXIoYXJyYXksIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHJldHVybiBuYW1lICE9PSAnZGVzY3JpcHRpb24nICYmIG5hbWUgIT09ICdudW1iZXInICYmIG5hbWUgIT09ICdtZXNzYWdlJztcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gYXJyYXk7XG4gIH07XG5cbiAgZXhwb3J0cy5rZXlzID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgIHJldHVybiBFUlJPUl9QUk9QRVJUWV9GSUxURVIob2JqZWN0LCBrZXlzKG9iamVjdCkpO1xuICB9O1xuICBleHBvcnRzLmdldE93blByb3BlcnR5TmFtZXMgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgcmV0dXJuIEVSUk9SX1BST1BFUlRZX0ZJTFRFUihvYmplY3QsIGdldE93blByb3BlcnR5TmFtZXMob2JqZWN0KSk7XG4gIH07XG59IGVsc2Uge1xuICBleHBvcnRzLmtleXMgPSBrZXlzO1xuICBleHBvcnRzLmdldE93blByb3BlcnR5TmFtZXMgPSBnZXRPd25Qcm9wZXJ0eU5hbWVzO1xufVxuXG4vLyBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIC0gc3VwcG9ydGVkIGluIElFOCBidXQgb25seSBvbiBkb20gZWxlbWVudHNcbmZ1bmN0aW9uIHZhbHVlT2JqZWN0KHZhbHVlLCBrZXkpIHtcbiAgcmV0dXJuIHsgdmFsdWU6IHZhbHVlW2tleV0gfTtcbn1cblxuaWYgKHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yID09PSAnZnVuY3Rpb24nKSB7XG4gIHRyeSB7XG4gICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih7J2EnOiAxfSwgJ2EnKTtcbiAgICBleHBvcnRzLmdldE93blByb3BlcnR5RGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3I7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBJRTggZG9tIGVsZW1lbnQgaXNzdWUgLSB1c2UgYSB0cnkgY2F0Y2ggYW5kIGRlZmF1bHQgdG8gdmFsdWVPYmplY3RcbiAgICBleHBvcnRzLmdldE93blByb3BlcnR5RGVzY3JpcHRvciA9IGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih2YWx1ZSwga2V5KTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlT2JqZWN0KHZhbHVlLCBrZXkpO1xuICAgICAgfVxuICAgIH07XG4gIH1cbn0gZWxzZSB7XG4gIGV4cG9ydHMuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yID0gdmFsdWVPYmplY3Q7XG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxudmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghdXRpbC5pc051bWJlcihuKSB8fCBuIDwgMClcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKHV0aWwuaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAodXRpbC5pc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKHV0aWwuaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHV0aWwuaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIXV0aWwuaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIHV0aWwuaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAodXRpbC5pc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKHV0aWwuaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIHZhciBtO1xuICAgIGlmICghdXRpbC5pc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCF1dGlsLmlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghdXRpbC5pc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAodXRpbC5pc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmICh1dGlsLmlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAodXRpbC5pc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKHV0aWwuaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmICh1dGlsLmlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07IiwiXG4vLyBub3QgaW1wbGVtZW50ZWRcbi8vIFRoZSByZWFzb24gZm9yIGhhdmluZyBhbiBlbXB0eSBmaWxlIGFuZCBub3QgdGhyb3dpbmcgaXMgdG8gYWxsb3dcbi8vIHVudHJhZGl0aW9uYWwgaW1wbGVtZW50YXRpb24gb2YgdGhpcyBtb2R1bGUuXG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxudmFyIHNoaW1zID0gcmVxdWlyZSgnX3NoaW1zJyk7XG5cbnZhciBmb3JtYXRSZWdFeHAgPSAvJVtzZGolXS9nO1xuZXhwb3J0cy5mb3JtYXQgPSBmdW5jdGlvbihmKSB7XG4gIGlmICghaXNTdHJpbmcoZikpIHtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvYmplY3RzLnB1c2goaW5zcGVjdChhcmd1bWVudHNbaV0pKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iamVjdHMuam9pbignICcpO1xuICB9XG5cbiAgdmFyIGkgPSAxO1xuICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgdmFyIGxlbiA9IGFyZ3MubGVuZ3RoO1xuICB2YXIgc3RyID0gU3RyaW5nKGYpLnJlcGxhY2UoZm9ybWF0UmVnRXhwLCBmdW5jdGlvbih4KSB7XG4gICAgaWYgKHggPT09ICclJScpIHJldHVybiAnJSc7XG4gICAgaWYgKGkgPj0gbGVuKSByZXR1cm4geDtcbiAgICBzd2l0Y2ggKHgpIHtcbiAgICAgIGNhc2UgJyVzJzogcmV0dXJuIFN0cmluZyhhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWQnOiByZXR1cm4gTnVtYmVyKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclaic6XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGFyZ3NbaSsrXSk7XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICByZXR1cm4gJ1tDaXJjdWxhcl0nO1xuICAgICAgICB9XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4geDtcbiAgICB9XG4gIH0pO1xuICBmb3IgKHZhciB4ID0gYXJnc1tpXTsgaSA8IGxlbjsgeCA9IGFyZ3NbKytpXSkge1xuICAgIGlmIChpc051bGwoeCkgfHwgIWlzT2JqZWN0KHgpKSB7XG4gICAgICBzdHIgKz0gJyAnICsgeDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RyICs9ICcgJyArIGluc3BlY3QoeCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBzdHI7XG59O1xuXG4vKipcbiAqIEVjaG9zIHRoZSB2YWx1ZSBvZiBhIHZhbHVlLiBUcnlzIHRvIHByaW50IHRoZSB2YWx1ZSBvdXRcbiAqIGluIHRoZSBiZXN0IHdheSBwb3NzaWJsZSBnaXZlbiB0aGUgZGlmZmVyZW50IHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB0byBwcmludCBvdXQuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25hbCBvcHRpb25zIG9iamVjdCB0aGF0IGFsdGVycyB0aGUgb3V0cHV0LlxuICovXG4vKiBsZWdhY3k6IG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgsIGNvbG9ycyovXG5mdW5jdGlvbiBpbnNwZWN0KG9iaiwgb3B0cykge1xuICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgdmFyIGN0eCA9IHtcbiAgICBzZWVuOiBbXSxcbiAgICBzdHlsaXplOiBzdHlsaXplTm9Db2xvclxuICB9O1xuICAvLyBsZWdhY3kuLi5cbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMykgY3R4LmRlcHRoID0gYXJndW1lbnRzWzJdO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSA0KSBjdHguY29sb3JzID0gYXJndW1lbnRzWzNdO1xuICBpZiAoaXNCb29sZWFuKG9wdHMpKSB7XG4gICAgLy8gbGVnYWN5Li4uXG4gICAgY3R4LnNob3dIaWRkZW4gPSBvcHRzO1xuICB9IGVsc2UgaWYgKG9wdHMpIHtcbiAgICAvLyBnb3QgYW4gXCJvcHRpb25zXCIgb2JqZWN0XG4gICAgZXhwb3J0cy5fZXh0ZW5kKGN0eCwgb3B0cyk7XG4gIH1cbiAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LnNob3dIaWRkZW4pKSBjdHguc2hvd0hpZGRlbiA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmRlcHRoKSkgY3R4LmRlcHRoID0gMjtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jb2xvcnMpKSBjdHguY29sb3JzID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY3VzdG9tSW5zcGVjdCkpIGN0eC5jdXN0b21JbnNwZWN0ID0gdHJ1ZTtcbiAgaWYgKGN0eC5jb2xvcnMpIGN0eC5zdHlsaXplID0gc3R5bGl6ZVdpdGhDb2xvcjtcbiAgcmV0dXJuIGZvcm1hdFZhbHVlKGN0eCwgb2JqLCBjdHguZGVwdGgpO1xufVxuZXhwb3J0cy5pbnNwZWN0ID0gaW5zcGVjdDtcblxuXG4vLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjZ3JhcGhpY3Ncbmluc3BlY3QuY29sb3JzID0ge1xuICAnYm9sZCcgOiBbMSwgMjJdLFxuICAnaXRhbGljJyA6IFszLCAyM10sXG4gICd1bmRlcmxpbmUnIDogWzQsIDI0XSxcbiAgJ2ludmVyc2UnIDogWzcsIDI3XSxcbiAgJ3doaXRlJyA6IFszNywgMzldLFxuICAnZ3JleScgOiBbOTAsIDM5XSxcbiAgJ2JsYWNrJyA6IFszMCwgMzldLFxuICAnYmx1ZScgOiBbMzQsIDM5XSxcbiAgJ2N5YW4nIDogWzM2LCAzOV0sXG4gICdncmVlbicgOiBbMzIsIDM5XSxcbiAgJ21hZ2VudGEnIDogWzM1LCAzOV0sXG4gICdyZWQnIDogWzMxLCAzOV0sXG4gICd5ZWxsb3cnIDogWzMzLCAzOV1cbn07XG5cbi8vIERvbid0IHVzZSAnYmx1ZScgbm90IHZpc2libGUgb24gY21kLmV4ZVxuaW5zcGVjdC5zdHlsZXMgPSB7XG4gICdzcGVjaWFsJzogJ2N5YW4nLFxuICAnbnVtYmVyJzogJ3llbGxvdycsXG4gICdib29sZWFuJzogJ3llbGxvdycsXG4gICd1bmRlZmluZWQnOiAnZ3JleScsXG4gICdudWxsJzogJ2JvbGQnLFxuICAnc3RyaW5nJzogJ2dyZWVuJyxcbiAgJ2RhdGUnOiAnbWFnZW50YScsXG4gIC8vIFwibmFtZVwiOiBpbnRlbnRpb25hbGx5IG5vdCBzdHlsaW5nXG4gICdyZWdleHAnOiAncmVkJ1xufTtcblxuXG5mdW5jdGlvbiBzdHlsaXplV2l0aENvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHZhciBzdHlsZSA9IGluc3BlY3Quc3R5bGVzW3N0eWxlVHlwZV07XG5cbiAgaWYgKHN0eWxlKSB7XG4gICAgcmV0dXJuICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMF0gKyAnbScgKyBzdHIgK1xuICAgICAgICAgICAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzFdICsgJ20nO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBzdHlsaXplTm9Db2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGFycmF5VG9IYXNoKGFycmF5KSB7XG4gIHZhciBoYXNoID0ge307XG5cbiAgc2hpbXMuZm9yRWFjaChhcnJheSwgZnVuY3Rpb24odmFsLCBpZHgpIHtcbiAgICBoYXNoW3ZhbF0gPSB0cnVlO1xuICB9KTtcblxuICByZXR1cm4gaGFzaDtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRWYWx1ZShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMpIHtcbiAgLy8gUHJvdmlkZSBhIGhvb2sgZm9yIHVzZXItc3BlY2lmaWVkIGluc3BlY3QgZnVuY3Rpb25zLlxuICAvLyBDaGVjayB0aGF0IHZhbHVlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluc3BlY3QgZnVuY3Rpb24gb24gaXRcbiAgaWYgKGN0eC5jdXN0b21JbnNwZWN0ICYmXG4gICAgICB2YWx1ZSAmJlxuICAgICAgaXNGdW5jdGlvbih2YWx1ZS5pbnNwZWN0KSAmJlxuICAgICAgLy8gRmlsdGVyIG91dCB0aGUgdXRpbCBtb2R1bGUsIGl0J3MgaW5zcGVjdCBmdW5jdGlvbiBpcyBzcGVjaWFsXG4gICAgICB2YWx1ZS5pbnNwZWN0ICE9PSBleHBvcnRzLmluc3BlY3QgJiZcbiAgICAgIC8vIEFsc28gZmlsdGVyIG91dCBhbnkgcHJvdG90eXBlIG9iamVjdHMgdXNpbmcgdGhlIGNpcmN1bGFyIGNoZWNrLlxuICAgICAgISh2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUgPT09IHZhbHVlKSkge1xuICAgIHZhciByZXQgPSB2YWx1ZS5pbnNwZWN0KHJlY3Vyc2VUaW1lcyk7XG4gICAgaWYgKCFpc1N0cmluZyhyZXQpKSB7XG4gICAgICByZXQgPSBmb3JtYXRWYWx1ZShjdHgsIHJldCwgcmVjdXJzZVRpbWVzKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8vIFByaW1pdGl2ZSB0eXBlcyBjYW5ub3QgaGF2ZSBwcm9wZXJ0aWVzXG4gIHZhciBwcmltaXRpdmUgPSBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSk7XG4gIGlmIChwcmltaXRpdmUpIHtcbiAgICByZXR1cm4gcHJpbWl0aXZlO1xuICB9XG5cbiAgLy8gTG9vayB1cCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0LlxuICB2YXIga2V5cyA9IHNoaW1zLmtleXModmFsdWUpO1xuICB2YXIgdmlzaWJsZUtleXMgPSBhcnJheVRvSGFzaChrZXlzKTtcblxuICBpZiAoY3R4LnNob3dIaWRkZW4pIHtcbiAgICBrZXlzID0gc2hpbXMuZ2V0T3duUHJvcGVydHlOYW1lcyh2YWx1ZSk7XG4gIH1cblxuICAvLyBTb21lIHR5cGUgb2Ygb2JqZWN0IHdpdGhvdXQgcHJvcGVydGllcyBjYW4gYmUgc2hvcnRjdXR0ZWQuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIGlmIChpc0Z1bmN0aW9uKHZhbHVlKSkge1xuICAgICAgdmFyIG5hbWUgPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW0Z1bmN0aW9uJyArIG5hbWUgKyAnXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfVxuICAgIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoRGF0ZS5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdkYXRlJyk7XG4gICAgfVxuICAgIGlmIChpc0Vycm9yKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICB2YXIgYmFzZSA9ICcnLCBhcnJheSA9IGZhbHNlLCBicmFjZXMgPSBbJ3snLCAnfSddO1xuXG4gIC8vIE1ha2UgQXJyYXkgc2F5IHRoYXQgdGhleSBhcmUgQXJyYXlcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgYXJyYXkgPSB0cnVlO1xuICAgIGJyYWNlcyA9IFsnWycsICddJ107XG4gIH1cblxuICAvLyBNYWtlIGZ1bmN0aW9ucyBzYXkgdGhhdCB0aGV5IGFyZSBmdW5jdGlvbnNcbiAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgdmFyIG4gPSB2YWx1ZS5uYW1lID8gJzogJyArIHZhbHVlLm5hbWUgOiAnJztcbiAgICBiYXNlID0gJyBbRnVuY3Rpb24nICsgbiArICddJztcbiAgfVxuXG4gIC8vIE1ha2UgUmVnRXhwcyBzYXkgdGhhdCB0aGV5IGFyZSBSZWdFeHBzXG4gIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZGF0ZXMgd2l0aCBwcm9wZXJ0aWVzIGZpcnN0IHNheSB0aGUgZGF0ZVxuICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBEYXRlLnByb3RvdHlwZS50b1VUQ1N0cmluZy5jYWxsKHZhbHVlKTtcbiAgfVxuXG4gIC8vIE1ha2UgZXJyb3Igd2l0aCBtZXNzYWdlIGZpcnN0IHNheSB0aGUgZXJyb3JcbiAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIGlmIChrZXlzLmxlbmd0aCA9PT0gMCAmJiAoIWFycmF5IHx8IHZhbHVlLmxlbmd0aCA9PSAwKSkge1xuICAgIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgYnJhY2VzWzFdO1xuICB9XG5cbiAgaWYgKHJlY3Vyc2VUaW1lcyA8IDApIHtcbiAgICBpZiAoaXNSZWdFeHAodmFsdWUpKSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoUmVnRXhwLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ3JlZ2V4cCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY3R4LnN0eWxpemUoJ1tPYmplY3RdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cblxuICBjdHguc2Vlbi5wdXNoKHZhbHVlKTtcblxuICB2YXIgb3V0cHV0O1xuICBpZiAoYXJyYXkpIHtcbiAgICBvdXRwdXQgPSBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKTtcbiAgfSBlbHNlIHtcbiAgICBvdXRwdXQgPSBrZXlzLm1hcChmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiBmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXksIGFycmF5KTtcbiAgICB9KTtcbiAgfVxuXG4gIGN0eC5zZWVuLnBvcCgpO1xuXG4gIHJldHVybiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlKSlcbiAgICByZXR1cm4gY3R4LnN0eWxpemUoJ3VuZGVmaW5lZCcsICd1bmRlZmluZWQnKTtcbiAgaWYgKGlzU3RyaW5nKHZhbHVlKSkge1xuICAgIHZhciBzaW1wbGUgPSAnXFwnJyArIEpTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9eXCJ8XCIkL2csICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFxcIi9nLCAnXCInKSArICdcXCcnO1xuICAgIHJldHVybiBjdHguc3R5bGl6ZShzaW1wbGUsICdzdHJpbmcnKTtcbiAgfVxuICBpZiAoaXNOdW1iZXIodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnbnVtYmVyJyk7XG4gIGlmIChpc0Jvb2xlYW4odmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnJyArIHZhbHVlLCAnYm9vbGVhbicpO1xuICAvLyBGb3Igc29tZSByZWFzb24gdHlwZW9mIG51bGwgaXMgXCJvYmplY3RcIiwgc28gc3BlY2lhbCBjYXNlIGhlcmUuXG4gIGlmIChpc051bGwodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0RXJyb3IodmFsdWUpIHtcbiAgcmV0dXJuICdbJyArIEVycm9yLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSArICddJztcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRBcnJheShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLCBrZXlzKSB7XG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyArK2kpIHtcbiAgICBpZiAoaGFzT3duUHJvcGVydHkodmFsdWUsIFN0cmluZyhpKSkpIHtcbiAgICAgIG91dHB1dC5wdXNoKGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsXG4gICAgICAgICAgU3RyaW5nKGkpLCB0cnVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dHB1dC5wdXNoKCcnKTtcbiAgICB9XG4gIH1cblxuICBzaGltcy5mb3JFYWNoKGtleXMsIGZ1bmN0aW9uKGtleSkge1xuICAgIGlmICgha2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBrZXksIHRydWUpKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gb3V0cHV0O1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpIHtcbiAgdmFyIG5hbWUsIHN0ciwgZGVzYztcbiAgZGVzYyA9IHNoaW1zLmdldE93blByb3BlcnR5RGVzY3JpcHRvcih2YWx1ZSwga2V5KSB8fCB7IHZhbHVlOiB2YWx1ZVtrZXldIH07XG4gIGlmIChkZXNjLmdldCkge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tTZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWhhc093blByb3BlcnR5KHZpc2libGVLZXlzLCBrZXkpKSB7XG4gICAgbmFtZSA9ICdbJyArIGtleSArICddJztcbiAgfVxuICBpZiAoIXN0cikge1xuICAgIGlmIChzaGltcy5pbmRleE9mKGN0eC5zZWVuLCBkZXNjLnZhbHVlKSA8IDApIHtcbiAgICAgIGlmIChpc051bGwocmVjdXJzZVRpbWVzKSkge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCByZWN1cnNlVGltZXMgLSAxKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdHIuaW5kZXhPZignXFxuJykgPiAtMSkge1xuICAgICAgICBpZiAoYXJyYXkpIHtcbiAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0ciA9ICdcXG4nICsgc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0NpcmN1bGFyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmIChpc1VuZGVmaW5lZChuYW1lKSkge1xuICAgIGlmIChhcnJheSAmJiBrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBuYW1lID0gSlNPTi5zdHJpbmdpZnkoJycgKyBrZXkpO1xuICAgIGlmIChuYW1lLm1hdGNoKC9eXCIoW2EtekEtWl9dW2EtekEtWl8wLTldKilcIiQvKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ3N0cmluZycpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lICsgJzogJyArIHN0cjtcbn1cblxuXG5mdW5jdGlvbiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcykge1xuICB2YXIgbnVtTGluZXNFc3QgPSAwO1xuICB2YXIgbGVuZ3RoID0gc2hpbXMucmVkdWNlKG91dHB1dCwgZnVuY3Rpb24ocHJldiwgY3VyKSB7XG4gICAgbnVtTGluZXNFc3QrKztcbiAgICBpZiAoY3VyLmluZGV4T2YoJ1xcbicpID49IDApIG51bUxpbmVzRXN0Kys7XG4gICAgcmV0dXJuIHByZXYgKyBjdXIucmVwbGFjZSgvXFx1MDAxYlxcW1xcZFxcZD9tL2csICcnKS5sZW5ndGggKyAxO1xuICB9LCAwKTtcblxuICBpZiAobGVuZ3RoID4gNjApIHtcbiAgICByZXR1cm4gYnJhY2VzWzBdICtcbiAgICAgICAgICAgKGJhc2UgPT09ICcnID8gJycgOiBiYXNlICsgJ1xcbiAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIG91dHB1dC5qb2luKCcsXFxuICAnKSArXG4gICAgICAgICAgICcgJyArXG4gICAgICAgICAgIGJyYWNlc1sxXTtcbiAgfVxuXG4gIHJldHVybiBicmFjZXNbMF0gKyBiYXNlICsgJyAnICsgb3V0cHV0LmpvaW4oJywgJykgKyAnICcgKyBicmFjZXNbMV07XG59XG5cblxuLy8gTk9URTogVGhlc2UgdHlwZSBjaGVja2luZyBmdW5jdGlvbnMgaW50ZW50aW9uYWxseSBkb24ndCB1c2UgYGluc3RhbmNlb2ZgXG4vLyBiZWNhdXNlIGl0IGlzIGZyYWdpbGUgYW5kIGNhbiBiZSBlYXNpbHkgZmFrZWQgd2l0aCBgT2JqZWN0LmNyZWF0ZSgpYC5cbmZ1bmN0aW9uIGlzQXJyYXkoYXIpIHtcbiAgcmV0dXJuIHNoaW1zLmlzQXJyYXkoYXIpO1xufVxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gaXNCb29sZWFuKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nO1xufVxuZXhwb3J0cy5pc0Jvb2xlYW4gPSBpc0Jvb2xlYW47XG5cbmZ1bmN0aW9uIGlzTnVsbChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsID0gaXNOdWxsO1xuXG5mdW5jdGlvbiBpc051bGxPclVuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGxPclVuZGVmaW5lZCA9IGlzTnVsbE9yVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyO1xuXG5mdW5jdGlvbiBpc1N0cmluZyhhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnO1xufVxuZXhwb3J0cy5pc1N0cmluZyA9IGlzU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1N5bWJvbChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnO1xufVxuZXhwb3J0cy5pc1N5bWJvbCA9IGlzU3ltYm9sO1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuZXhwb3J0cy5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gaXNPYmplY3QocmUpICYmIG9iamVjdFRvU3RyaW5nKHJlKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7XG59XG5leHBvcnRzLmlzUmVnRXhwID0gaXNSZWdFeHA7XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnO1xufVxuZXhwb3J0cy5pc09iamVjdCA9IGlzT2JqZWN0O1xuXG5mdW5jdGlvbiBpc0RhdGUoZCkge1xuICByZXR1cm4gaXNPYmplY3QoZCkgJiYgb2JqZWN0VG9TdHJpbmcoZCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cbmV4cG9ydHMuaXNEYXRlID0gaXNEYXRlO1xuXG5mdW5jdGlvbiBpc0Vycm9yKGUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGUpICYmIG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nO1xufVxuZXhwb3J0cy5pc0Vycm9yID0gaXNFcnJvcjtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbCB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnIHx8ICAvLyBFUzYgc3ltYm9sXG4gICAgICAgICB0eXBlb2YgYXJnID09PSAndW5kZWZpbmVkJztcbn1cbmV4cG9ydHMuaXNQcmltaXRpdmUgPSBpc1ByaW1pdGl2ZTtcblxuZnVuY3Rpb24gaXNCdWZmZXIoYXJnKSB7XG4gIHJldHVybiBhcmcgJiYgdHlwZW9mIGFyZyA9PT0gJ29iamVjdCdcbiAgICAmJiB0eXBlb2YgYXJnLmNvcHkgPT09ICdmdW5jdGlvbidcbiAgICAmJiB0eXBlb2YgYXJnLmZpbGwgPT09ICdmdW5jdGlvbidcbiAgICAmJiB0eXBlb2YgYXJnLmJpbmFyeVNsaWNlID09PSAnZnVuY3Rpb24nXG4gIDtcbn1cbmV4cG9ydHMuaXNCdWZmZXIgPSBpc0J1ZmZlcjtcblxuZnVuY3Rpb24gb2JqZWN0VG9TdHJpbmcobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufVxuXG5cbmZ1bmN0aW9uIHBhZChuKSB7XG4gIHJldHVybiBuIDwgMTAgPyAnMCcgKyBuLnRvU3RyaW5nKDEwKSA6IG4udG9TdHJpbmcoMTApO1xufVxuXG5cbnZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJyxcbiAgICAgICAgICAgICAgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbi8vIDI2IEZlYiAxNjoxOTozNFxuZnVuY3Rpb24gdGltZXN0YW1wKCkge1xuICB2YXIgZCA9IG5ldyBEYXRlKCk7XG4gIHZhciB0aW1lID0gW3BhZChkLmdldEhvdXJzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRNaW51dGVzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRTZWNvbmRzKCkpXS5qb2luKCc6Jyk7XG4gIHJldHVybiBbZC5nZXREYXRlKCksIG1vbnRoc1tkLmdldE1vbnRoKCldLCB0aW1lXS5qb2luKCcgJyk7XG59XG5cblxuLy8gbG9nIGlzIGp1c3QgYSB0aGluIHdyYXBwZXIgdG8gY29uc29sZS5sb2cgdGhhdCBwcmVwZW5kcyBhIHRpbWVzdGFtcFxuZXhwb3J0cy5sb2cgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJyVzIC0gJXMnLCB0aW1lc3RhbXAoKSwgZXhwb3J0cy5mb3JtYXQuYXBwbHkoZXhwb3J0cywgYXJndW1lbnRzKSk7XG59O1xuXG5cbi8qKlxuICogSW5oZXJpdCB0aGUgcHJvdG90eXBlIG1ldGhvZHMgZnJvbSBvbmUgY29uc3RydWN0b3IgaW50byBhbm90aGVyLlxuICpcbiAqIFRoZSBGdW5jdGlvbi5wcm90b3R5cGUuaW5oZXJpdHMgZnJvbSBsYW5nLmpzIHJld3JpdHRlbiBhcyBhIHN0YW5kYWxvbmVcbiAqIGZ1bmN0aW9uIChub3Qgb24gRnVuY3Rpb24ucHJvdG90eXBlKS4gTk9URTogSWYgdGhpcyBmaWxlIGlzIHRvIGJlIGxvYWRlZFxuICogZHVyaW5nIGJvb3RzdHJhcHBpbmcgdGhpcyBmdW5jdGlvbiBuZWVkcyB0byBiZSByZXdyaXR0ZW4gdXNpbmcgc29tZSBuYXRpdmVcbiAqIGZ1bmN0aW9ucyBhcyBwcm90b3R5cGUgc2V0dXAgdXNpbmcgbm9ybWFsIEphdmFTY3JpcHQgZG9lcyBub3Qgd29yayBhc1xuICogZXhwZWN0ZWQgZHVyaW5nIGJvb3RzdHJhcHBpbmcgKHNlZSBtaXJyb3IuanMgaW4gcjExNDkwMykuXG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gY3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB3aGljaCBuZWVkcyB0byBpbmhlcml0IHRoZVxuICogICAgIHByb3RvdHlwZS5cbiAqIEBwYXJhbSB7ZnVuY3Rpb259IHN1cGVyQ3RvciBDb25zdHJ1Y3RvciBmdW5jdGlvbiB0byBpbmhlcml0IHByb3RvdHlwZSBmcm9tLlxuICovXG5leHBvcnRzLmluaGVyaXRzID0gZnVuY3Rpb24oY3Rvciwgc3VwZXJDdG9yKSB7XG4gIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yO1xuICBjdG9yLnByb3RvdHlwZSA9IHNoaW1zLmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgY29uc3RydWN0b3I6IHtcbiAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG59O1xuXG5leHBvcnRzLl9leHRlbmQgPSBmdW5jdGlvbihvcmlnaW4sIGFkZCkge1xuICAvLyBEb24ndCBkbyBhbnl0aGluZyBpZiBhZGQgaXNuJ3QgYW4gb2JqZWN0XG4gIGlmICghYWRkIHx8ICFpc09iamVjdChhZGQpKSByZXR1cm4gb3JpZ2luO1xuXG4gIHZhciBrZXlzID0gc2hpbXMua2V5cyhhZGQpO1xuICB2YXIgaSA9IGtleXMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgb3JpZ2luW2tleXNbaV1dID0gYWRkW2tleXNbaV1dO1xuICB9XG4gIHJldHVybiBvcmlnaW47XG59O1xuXG5mdW5jdGlvbiBoYXNPd25Qcm9wZXJ0eShvYmosIHByb3ApIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApO1xufVxuIiwidmFyIGhhbmRsZWJhcnMgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2Jhc2VcIiksXG5cbi8vIEVhY2ggb2YgdGhlc2UgYXVnbWVudCB0aGUgSGFuZGxlYmFycyBvYmplY3QuIE5vIG5lZWQgdG8gc2V0dXAgaGVyZS5cbi8vIChUaGlzIGlzIGRvbmUgdG8gZWFzaWx5IHNoYXJlIGNvZGUgYmV0d2VlbiBjb21tb25qcyBhbmQgYnJvd3NlIGVudnMpXG4gIHV0aWxzID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy91dGlsc1wiKSxcbiAgY29tcGlsZXIgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyXCIpLFxuICBydW50aW1lID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9ydW50aW1lXCIpO1xuXG52YXIgY3JlYXRlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBoYiA9IGhhbmRsZWJhcnMuY3JlYXRlKCk7XG5cbiAgdXRpbHMuYXR0YWNoKGhiKTtcbiAgY29tcGlsZXIuYXR0YWNoKGhiKTtcbiAgcnVudGltZS5hdHRhY2goaGIpO1xuXG4gIHJldHVybiBoYjtcbn07XG5cbnZhciBIYW5kbGViYXJzID0gY3JlYXRlKCk7XG5IYW5kbGViYXJzLmNyZWF0ZSA9IGNyZWF0ZTtcblxubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzOyAvLyBpbnN0YW50aWF0ZSBhbiBpbnN0YW5jZVxuXG4vLyBQdWJsaXNoIGEgTm9kZS5qcyByZXF1aXJlKCkgaGFuZGxlciBmb3IgLmhhbmRsZWJhcnMgYW5kIC5oYnMgZmlsZXNcbmlmIChyZXF1aXJlLmV4dGVuc2lvbnMpIHtcbiAgdmFyIGV4dGVuc2lvbiA9IGZ1bmN0aW9uKG1vZHVsZSwgZmlsZW5hbWUpIHtcbiAgICB2YXIgZnMgPSByZXF1aXJlKFwiZnNcIik7XG4gICAgdmFyIHRlbXBsYXRlU3RyaW5nID0gZnMucmVhZEZpbGVTeW5jKGZpbGVuYW1lLCBcInV0ZjhcIik7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLmNvbXBpbGUodGVtcGxhdGVTdHJpbmcpO1xuICB9O1xuICByZXF1aXJlLmV4dGVuc2lvbnNbXCIuaGFuZGxlYmFyc1wiXSA9IGV4dGVuc2lvbjtcbiAgcmVxdWlyZS5leHRlbnNpb25zW1wiLmhic1wiXSA9IGV4dGVuc2lvbjtcbn1cblxuLy8gQkVHSU4oQlJPV1NFUilcblxuLy8gRU5EKEJST1dTRVIpXG5cbi8vIFVTQUdFOlxuLy8gdmFyIGhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYW5kbGViYXJzJyk7XG5cbi8vIHZhciBzaW5nbGV0b24gPSBoYW5kbGViYXJzLkhhbmRsZWJhcnMsXG4vLyAgbG9jYWwgPSBoYW5kbGViYXJzLmNyZWF0ZSgpO1xuIiwiLypqc2hpbnQgZXFudWxsOiB0cnVlICovXG5cbm1vZHVsZS5leHBvcnRzLmNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuXG52YXIgSGFuZGxlYmFycyA9IHt9O1xuXG4vLyBCRUdJTihCUk9XU0VSKVxuXG5IYW5kbGViYXJzLlZFUlNJT04gPSBcIjEuMC4wXCI7XG5IYW5kbGViYXJzLkNPTVBJTEVSX1JFVklTSU9OID0gNDtcblxuSGFuZGxlYmFycy5SRVZJU0lPTl9DSEFOR0VTID0ge1xuICAxOiAnPD0gMS4wLnJjLjInLCAvLyAxLjAucmMuMiBpcyBhY3R1YWxseSByZXYyIGJ1dCBkb2Vzbid0IHJlcG9ydCBpdFxuICAyOiAnPT0gMS4wLjAtcmMuMycsXG4gIDM6ICc9PSAxLjAuMC1yYy40JyxcbiAgNDogJz49IDEuMC4wJ1xufTtcblxuSGFuZGxlYmFycy5oZWxwZXJzICA9IHt9O1xuSGFuZGxlYmFycy5wYXJ0aWFscyA9IHt9O1xuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLFxuICAgIGZ1bmN0aW9uVHlwZSA9ICdbb2JqZWN0IEZ1bmN0aW9uXScsXG4gICAgb2JqZWN0VHlwZSA9ICdbb2JqZWN0IE9iamVjdF0nO1xuXG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyID0gZnVuY3Rpb24obmFtZSwgZm4sIGludmVyc2UpIHtcbiAgaWYgKHRvU3RyaW5nLmNhbGwobmFtZSkgPT09IG9iamVjdFR5cGUpIHtcbiAgICBpZiAoaW52ZXJzZSB8fCBmbikgeyB0aHJvdyBuZXcgSGFuZGxlYmFycy5FeGNlcHRpb24oJ0FyZyBub3Qgc3VwcG9ydGVkIHdpdGggbXVsdGlwbGUgaGVscGVycycpOyB9XG4gICAgSGFuZGxlYmFycy5VdGlscy5leHRlbmQodGhpcy5oZWxwZXJzLCBuYW1lKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoaW52ZXJzZSkgeyBmbi5ub3QgPSBpbnZlcnNlOyB9XG4gICAgdGhpcy5oZWxwZXJzW25hbWVdID0gZm47XG4gIH1cbn07XG5cbkhhbmRsZWJhcnMucmVnaXN0ZXJQYXJ0aWFsID0gZnVuY3Rpb24obmFtZSwgc3RyKSB7XG4gIGlmICh0b1N0cmluZy5jYWxsKG5hbWUpID09PSBvYmplY3RUeXBlKSB7XG4gICAgSGFuZGxlYmFycy5VdGlscy5leHRlbmQodGhpcy5wYXJ0aWFscywgIG5hbWUpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMucGFydGlhbHNbbmFtZV0gPSBzdHI7XG4gIH1cbn07XG5cbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIoJ2hlbHBlck1pc3NpbmcnLCBmdW5jdGlvbihhcmcpIHtcbiAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTWlzc2luZyBoZWxwZXI6ICdcIiArIGFyZyArIFwiJ1wiKTtcbiAgfVxufSk7XG5cbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIoJ2Jsb2NrSGVscGVyTWlzc2luZycsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgdmFyIGludmVyc2UgPSBvcHRpb25zLmludmVyc2UgfHwgZnVuY3Rpb24oKSB7fSwgZm4gPSBvcHRpb25zLmZuO1xuXG4gIHZhciB0eXBlID0gdG9TdHJpbmcuY2FsbChjb250ZXh0KTtcblxuICBpZih0eXBlID09PSBmdW5jdGlvblR5cGUpIHsgY29udGV4dCA9IGNvbnRleHQuY2FsbCh0aGlzKTsgfVxuXG4gIGlmKGNvbnRleHQgPT09IHRydWUpIHtcbiAgICByZXR1cm4gZm4odGhpcyk7XG4gIH0gZWxzZSBpZihjb250ZXh0ID09PSBmYWxzZSB8fCBjb250ZXh0ID09IG51bGwpIHtcbiAgICByZXR1cm4gaW52ZXJzZSh0aGlzKTtcbiAgfSBlbHNlIGlmKHR5cGUgPT09IFwiW29iamVjdCBBcnJheV1cIikge1xuICAgIGlmKGNvbnRleHQubGVuZ3RoID4gMCkge1xuICAgICAgcmV0dXJuIEhhbmRsZWJhcnMuaGVscGVycy5lYWNoKGNvbnRleHQsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaW52ZXJzZSh0aGlzKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZuKGNvbnRleHQpO1xuICB9XG59KTtcblxuSGFuZGxlYmFycy5LID0gZnVuY3Rpb24oKSB7fTtcblxuSGFuZGxlYmFycy5jcmVhdGVGcmFtZSA9IE9iamVjdC5jcmVhdGUgfHwgZnVuY3Rpb24ob2JqZWN0KSB7XG4gIEhhbmRsZWJhcnMuSy5wcm90b3R5cGUgPSBvYmplY3Q7XG4gIHZhciBvYmogPSBuZXcgSGFuZGxlYmFycy5LKCk7XG4gIEhhbmRsZWJhcnMuSy5wcm90b3R5cGUgPSBudWxsO1xuICByZXR1cm4gb2JqO1xufTtcblxuSGFuZGxlYmFycy5sb2dnZXIgPSB7XG4gIERFQlVHOiAwLCBJTkZPOiAxLCBXQVJOOiAyLCBFUlJPUjogMywgbGV2ZWw6IDMsXG5cbiAgbWV0aG9kTWFwOiB7MDogJ2RlYnVnJywgMTogJ2luZm8nLCAyOiAnd2FybicsIDM6ICdlcnJvcid9LFxuXG4gIC8vIGNhbiBiZSBvdmVycmlkZGVuIGluIHRoZSBob3N0IGVudmlyb25tZW50XG4gIGxvZzogZnVuY3Rpb24obGV2ZWwsIG9iaikge1xuICAgIGlmIChIYW5kbGViYXJzLmxvZ2dlci5sZXZlbCA8PSBsZXZlbCkge1xuICAgICAgdmFyIG1ldGhvZCA9IEhhbmRsZWJhcnMubG9nZ2VyLm1ldGhvZE1hcFtsZXZlbF07XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmIGNvbnNvbGVbbWV0aG9kXSkge1xuICAgICAgICBjb25zb2xlW21ldGhvZF0uY2FsbChjb25zb2xlLCBvYmopO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcblxuSGFuZGxlYmFycy5sb2cgPSBmdW5jdGlvbihsZXZlbCwgb2JqKSB7IEhhbmRsZWJhcnMubG9nZ2VyLmxvZyhsZXZlbCwgb2JqKTsgfTtcblxuSGFuZGxlYmFycy5yZWdpc3RlckhlbHBlcignZWFjaCcsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgdmFyIGZuID0gb3B0aW9ucy5mbiwgaW52ZXJzZSA9IG9wdGlvbnMuaW52ZXJzZTtcbiAgdmFyIGkgPSAwLCByZXQgPSBcIlwiLCBkYXRhO1xuXG4gIHZhciB0eXBlID0gdG9TdHJpbmcuY2FsbChjb250ZXh0KTtcbiAgaWYodHlwZSA9PT0gZnVuY3Rpb25UeXBlKSB7IGNvbnRleHQgPSBjb250ZXh0LmNhbGwodGhpcyk7IH1cblxuICBpZiAob3B0aW9ucy5kYXRhKSB7XG4gICAgZGF0YSA9IEhhbmRsZWJhcnMuY3JlYXRlRnJhbWUob3B0aW9ucy5kYXRhKTtcbiAgfVxuXG4gIGlmKGNvbnRleHQgJiYgdHlwZW9mIGNvbnRleHQgPT09ICdvYmplY3QnKSB7XG4gICAgaWYoY29udGV4dCBpbnN0YW5jZW9mIEFycmF5KXtcbiAgICAgIGZvcih2YXIgaiA9IGNvbnRleHQubGVuZ3RoOyBpPGo7IGkrKykge1xuICAgICAgICBpZiAoZGF0YSkgeyBkYXRhLmluZGV4ID0gaTsgfVxuICAgICAgICByZXQgPSByZXQgKyBmbihjb250ZXh0W2ldLCB7IGRhdGE6IGRhdGEgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvcih2YXIga2V5IGluIGNvbnRleHQpIHtcbiAgICAgICAgaWYoY29udGV4dC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgaWYoZGF0YSkgeyBkYXRhLmtleSA9IGtleTsgfVxuICAgICAgICAgIHJldCA9IHJldCArIGZuKGNvbnRleHRba2V5XSwge2RhdGE6IGRhdGF9KTtcbiAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZihpID09PSAwKXtcbiAgICByZXQgPSBpbnZlcnNlKHRoaXMpO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn0pO1xuXG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyKCdpZicsIGZ1bmN0aW9uKGNvbmRpdGlvbmFsLCBvcHRpb25zKSB7XG4gIHZhciB0eXBlID0gdG9TdHJpbmcuY2FsbChjb25kaXRpb25hbCk7XG4gIGlmKHR5cGUgPT09IGZ1bmN0aW9uVHlwZSkgeyBjb25kaXRpb25hbCA9IGNvbmRpdGlvbmFsLmNhbGwodGhpcyk7IH1cblxuICBpZighY29uZGl0aW9uYWwgfHwgSGFuZGxlYmFycy5VdGlscy5pc0VtcHR5KGNvbmRpdGlvbmFsKSkge1xuICAgIHJldHVybiBvcHRpb25zLmludmVyc2UodGhpcyk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9wdGlvbnMuZm4odGhpcyk7XG4gIH1cbn0pO1xuXG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyKCd1bmxlc3MnLCBmdW5jdGlvbihjb25kaXRpb25hbCwgb3B0aW9ucykge1xuICByZXR1cm4gSGFuZGxlYmFycy5oZWxwZXJzWydpZiddLmNhbGwodGhpcywgY29uZGl0aW9uYWwsIHtmbjogb3B0aW9ucy5pbnZlcnNlLCBpbnZlcnNlOiBvcHRpb25zLmZufSk7XG59KTtcblxuSGFuZGxlYmFycy5yZWdpc3RlckhlbHBlcignd2l0aCcsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgdmFyIHR5cGUgPSB0b1N0cmluZy5jYWxsKGNvbnRleHQpO1xuICBpZih0eXBlID09PSBmdW5jdGlvblR5cGUpIHsgY29udGV4dCA9IGNvbnRleHQuY2FsbCh0aGlzKTsgfVxuXG4gIGlmICghSGFuZGxlYmFycy5VdGlscy5pc0VtcHR5KGNvbnRleHQpKSByZXR1cm4gb3B0aW9ucy5mbihjb250ZXh0KTtcbn0pO1xuXG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyKCdsb2cnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gIHZhciBsZXZlbCA9IG9wdGlvbnMuZGF0YSAmJiBvcHRpb25zLmRhdGEubGV2ZWwgIT0gbnVsbCA/IHBhcnNlSW50KG9wdGlvbnMuZGF0YS5sZXZlbCwgMTApIDogMTtcbiAgSGFuZGxlYmFycy5sb2cobGV2ZWwsIGNvbnRleHQpO1xufSk7XG5cbi8vIEVORChCUk9XU0VSKVxuXG5yZXR1cm4gSGFuZGxlYmFycztcbn07XG4iLCJleHBvcnRzLmF0dGFjaCA9IGZ1bmN0aW9uKEhhbmRsZWJhcnMpIHtcblxuLy8gQkVHSU4oQlJPV1NFUilcbkhhbmRsZWJhcnMuQVNUID0ge307XG5cbkhhbmRsZWJhcnMuQVNULlByb2dyYW1Ob2RlID0gZnVuY3Rpb24oc3RhdGVtZW50cywgaW52ZXJzZSkge1xuICB0aGlzLnR5cGUgPSBcInByb2dyYW1cIjtcbiAgdGhpcy5zdGF0ZW1lbnRzID0gc3RhdGVtZW50cztcbiAgaWYoaW52ZXJzZSkgeyB0aGlzLmludmVyc2UgPSBuZXcgSGFuZGxlYmFycy5BU1QuUHJvZ3JhbU5vZGUoaW52ZXJzZSk7IH1cbn07XG5cbkhhbmRsZWJhcnMuQVNULk11c3RhY2hlTm9kZSA9IGZ1bmN0aW9uKHJhd1BhcmFtcywgaGFzaCwgdW5lc2NhcGVkKSB7XG4gIHRoaXMudHlwZSA9IFwibXVzdGFjaGVcIjtcbiAgdGhpcy5lc2NhcGVkID0gIXVuZXNjYXBlZDtcbiAgdGhpcy5oYXNoID0gaGFzaDtcblxuICB2YXIgaWQgPSB0aGlzLmlkID0gcmF3UGFyYW1zWzBdO1xuICB2YXIgcGFyYW1zID0gdGhpcy5wYXJhbXMgPSByYXdQYXJhbXMuc2xpY2UoMSk7XG5cbiAgLy8gYSBtdXN0YWNoZSBpcyBhbiBlbGlnaWJsZSBoZWxwZXIgaWY6XG4gIC8vICogaXRzIGlkIGlzIHNpbXBsZSAoYSBzaW5nbGUgcGFydCwgbm90IGB0aGlzYCBvciBgLi5gKVxuICB2YXIgZWxpZ2libGVIZWxwZXIgPSB0aGlzLmVsaWdpYmxlSGVscGVyID0gaWQuaXNTaW1wbGU7XG5cbiAgLy8gYSBtdXN0YWNoZSBpcyBkZWZpbml0ZWx5IGEgaGVscGVyIGlmOlxuICAvLyAqIGl0IGlzIGFuIGVsaWdpYmxlIGhlbHBlciwgYW5kXG4gIC8vICogaXQgaGFzIGF0IGxlYXN0IG9uZSBwYXJhbWV0ZXIgb3IgaGFzaCBzZWdtZW50XG4gIHRoaXMuaXNIZWxwZXIgPSBlbGlnaWJsZUhlbHBlciAmJiAocGFyYW1zLmxlbmd0aCB8fCBoYXNoKTtcblxuICAvLyBpZiBhIG11c3RhY2hlIGlzIGFuIGVsaWdpYmxlIGhlbHBlciBidXQgbm90IGEgZGVmaW5pdGVcbiAgLy8gaGVscGVyLCBpdCBpcyBhbWJpZ3VvdXMsIGFuZCB3aWxsIGJlIHJlc29sdmVkIGluIGEgbGF0ZXJcbiAgLy8gcGFzcyBvciBhdCBydW50aW1lLlxufTtcblxuSGFuZGxlYmFycy5BU1QuUGFydGlhbE5vZGUgPSBmdW5jdGlvbihwYXJ0aWFsTmFtZSwgY29udGV4dCkge1xuICB0aGlzLnR5cGUgICAgICAgICA9IFwicGFydGlhbFwiO1xuICB0aGlzLnBhcnRpYWxOYW1lICA9IHBhcnRpYWxOYW1lO1xuICB0aGlzLmNvbnRleHQgICAgICA9IGNvbnRleHQ7XG59O1xuXG5IYW5kbGViYXJzLkFTVC5CbG9ja05vZGUgPSBmdW5jdGlvbihtdXN0YWNoZSwgcHJvZ3JhbSwgaW52ZXJzZSwgY2xvc2UpIHtcbiAgdmFyIHZlcmlmeU1hdGNoID0gZnVuY3Rpb24ob3BlbiwgY2xvc2UpIHtcbiAgICBpZihvcGVuLm9yaWdpbmFsICE9PSBjbG9zZS5vcmlnaW5hbCkge1xuICAgICAgdGhyb3cgbmV3IEhhbmRsZWJhcnMuRXhjZXB0aW9uKG9wZW4ub3JpZ2luYWwgKyBcIiBkb2Vzbid0IG1hdGNoIFwiICsgY2xvc2Uub3JpZ2luYWwpO1xuICAgIH1cbiAgfTtcblxuICB2ZXJpZnlNYXRjaChtdXN0YWNoZS5pZCwgY2xvc2UpO1xuICB0aGlzLnR5cGUgPSBcImJsb2NrXCI7XG4gIHRoaXMubXVzdGFjaGUgPSBtdXN0YWNoZTtcbiAgdGhpcy5wcm9ncmFtICA9IHByb2dyYW07XG4gIHRoaXMuaW52ZXJzZSAgPSBpbnZlcnNlO1xuXG4gIGlmICh0aGlzLmludmVyc2UgJiYgIXRoaXMucHJvZ3JhbSkge1xuICAgIHRoaXMuaXNJbnZlcnNlID0gdHJ1ZTtcbiAgfVxufTtcblxuSGFuZGxlYmFycy5BU1QuQ29udGVudE5vZGUgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgdGhpcy50eXBlID0gXCJjb250ZW50XCI7XG4gIHRoaXMuc3RyaW5nID0gc3RyaW5nO1xufTtcblxuSGFuZGxlYmFycy5BU1QuSGFzaE5vZGUgPSBmdW5jdGlvbihwYWlycykge1xuICB0aGlzLnR5cGUgPSBcImhhc2hcIjtcbiAgdGhpcy5wYWlycyA9IHBhaXJzO1xufTtcblxuSGFuZGxlYmFycy5BU1QuSWROb2RlID0gZnVuY3Rpb24ocGFydHMpIHtcbiAgdGhpcy50eXBlID0gXCJJRFwiO1xuXG4gIHZhciBvcmlnaW5hbCA9IFwiXCIsXG4gICAgICBkaWcgPSBbXSxcbiAgICAgIGRlcHRoID0gMDtcblxuICBmb3IodmFyIGk9MCxsPXBhcnRzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICB2YXIgcGFydCA9IHBhcnRzW2ldLnBhcnQ7XG4gICAgb3JpZ2luYWwgKz0gKHBhcnRzW2ldLnNlcGFyYXRvciB8fCAnJykgKyBwYXJ0O1xuXG4gICAgaWYgKHBhcnQgPT09IFwiLi5cIiB8fCBwYXJ0ID09PSBcIi5cIiB8fCBwYXJ0ID09PSBcInRoaXNcIikge1xuICAgICAgaWYgKGRpZy5sZW5ndGggPiAwKSB7IHRocm93IG5ldyBIYW5kbGViYXJzLkV4Y2VwdGlvbihcIkludmFsaWQgcGF0aDogXCIgKyBvcmlnaW5hbCk7IH1cbiAgICAgIGVsc2UgaWYgKHBhcnQgPT09IFwiLi5cIikgeyBkZXB0aCsrOyB9XG4gICAgICBlbHNlIHsgdGhpcy5pc1Njb3BlZCA9IHRydWU7IH1cbiAgICB9XG4gICAgZWxzZSB7IGRpZy5wdXNoKHBhcnQpOyB9XG4gIH1cblxuICB0aGlzLm9yaWdpbmFsID0gb3JpZ2luYWw7XG4gIHRoaXMucGFydHMgICAgPSBkaWc7XG4gIHRoaXMuc3RyaW5nICAgPSBkaWcuam9pbignLicpO1xuICB0aGlzLmRlcHRoICAgID0gZGVwdGg7XG5cbiAgLy8gYW4gSUQgaXMgc2ltcGxlIGlmIGl0IG9ubHkgaGFzIG9uZSBwYXJ0LCBhbmQgdGhhdCBwYXJ0IGlzIG5vdFxuICAvLyBgLi5gIG9yIGB0aGlzYC5cbiAgdGhpcy5pc1NpbXBsZSA9IHBhcnRzLmxlbmd0aCA9PT0gMSAmJiAhdGhpcy5pc1Njb3BlZCAmJiBkZXB0aCA9PT0gMDtcblxuICB0aGlzLnN0cmluZ01vZGVWYWx1ZSA9IHRoaXMuc3RyaW5nO1xufTtcblxuSGFuZGxlYmFycy5BU1QuUGFydGlhbE5hbWVOb2RlID0gZnVuY3Rpb24obmFtZSkge1xuICB0aGlzLnR5cGUgPSBcIlBBUlRJQUxfTkFNRVwiO1xuICB0aGlzLm5hbWUgPSBuYW1lLm9yaWdpbmFsO1xufTtcblxuSGFuZGxlYmFycy5BU1QuRGF0YU5vZGUgPSBmdW5jdGlvbihpZCkge1xuICB0aGlzLnR5cGUgPSBcIkRBVEFcIjtcbiAgdGhpcy5pZCA9IGlkO1xufTtcblxuSGFuZGxlYmFycy5BU1QuU3RyaW5nTm9kZSA9IGZ1bmN0aW9uKHN0cmluZykge1xuICB0aGlzLnR5cGUgPSBcIlNUUklOR1wiO1xuICB0aGlzLm9yaWdpbmFsID1cbiAgICB0aGlzLnN0cmluZyA9XG4gICAgdGhpcy5zdHJpbmdNb2RlVmFsdWUgPSBzdHJpbmc7XG59O1xuXG5IYW5kbGViYXJzLkFTVC5JbnRlZ2VyTm9kZSA9IGZ1bmN0aW9uKGludGVnZXIpIHtcbiAgdGhpcy50eXBlID0gXCJJTlRFR0VSXCI7XG4gIHRoaXMub3JpZ2luYWwgPVxuICAgIHRoaXMuaW50ZWdlciA9IGludGVnZXI7XG4gIHRoaXMuc3RyaW5nTW9kZVZhbHVlID0gTnVtYmVyKGludGVnZXIpO1xufTtcblxuSGFuZGxlYmFycy5BU1QuQm9vbGVhbk5vZGUgPSBmdW5jdGlvbihib29sKSB7XG4gIHRoaXMudHlwZSA9IFwiQk9PTEVBTlwiO1xuICB0aGlzLmJvb2wgPSBib29sO1xuICB0aGlzLnN0cmluZ01vZGVWYWx1ZSA9IGJvb2wgPT09IFwidHJ1ZVwiO1xufTtcblxuSGFuZGxlYmFycy5BU1QuQ29tbWVudE5vZGUgPSBmdW5jdGlvbihjb21tZW50KSB7XG4gIHRoaXMudHlwZSA9IFwiY29tbWVudFwiO1xuICB0aGlzLmNvbW1lbnQgPSBjb21tZW50O1xufTtcblxuLy8gRU5EKEJST1dTRVIpXG5cbnJldHVybiBIYW5kbGViYXJzO1xufTtcblxuIiwidmFyIGhhbmRsZWJhcnMgPSByZXF1aXJlKFwiLi9wYXJzZXJcIik7XG5cbmV4cG9ydHMuYXR0YWNoID0gZnVuY3Rpb24oSGFuZGxlYmFycykge1xuXG4vLyBCRUdJTihCUk9XU0VSKVxuXG5IYW5kbGViYXJzLlBhcnNlciA9IGhhbmRsZWJhcnM7XG5cbkhhbmRsZWJhcnMucGFyc2UgPSBmdW5jdGlvbihpbnB1dCkge1xuXG4gIC8vIEp1c3QgcmV0dXJuIGlmIGFuIGFscmVhZHktY29tcGlsZSBBU1Qgd2FzIHBhc3NlZCBpbi5cbiAgaWYoaW5wdXQuY29uc3RydWN0b3IgPT09IEhhbmRsZWJhcnMuQVNULlByb2dyYW1Ob2RlKSB7IHJldHVybiBpbnB1dDsgfVxuXG4gIEhhbmRsZWJhcnMuUGFyc2VyLnl5ID0gSGFuZGxlYmFycy5BU1Q7XG4gIHJldHVybiBIYW5kbGViYXJzLlBhcnNlci5wYXJzZShpbnB1dCk7XG59O1xuXG4vLyBFTkQoQlJPV1NFUilcblxucmV0dXJuIEhhbmRsZWJhcnM7XG59O1xuIiwidmFyIGNvbXBpbGVyYmFzZSA9IHJlcXVpcmUoXCIuL2Jhc2VcIik7XG5cbmV4cG9ydHMuYXR0YWNoID0gZnVuY3Rpb24oSGFuZGxlYmFycykge1xuXG5jb21waWxlcmJhc2UuYXR0YWNoKEhhbmRsZWJhcnMpO1xuXG4vLyBCRUdJTihCUk9XU0VSKVxuXG4vKmpzaGludCBlcW51bGw6dHJ1ZSovXG52YXIgQ29tcGlsZXIgPSBIYW5kbGViYXJzLkNvbXBpbGVyID0gZnVuY3Rpb24oKSB7fTtcbnZhciBKYXZhU2NyaXB0Q29tcGlsZXIgPSBIYW5kbGViYXJzLkphdmFTY3JpcHRDb21waWxlciA9IGZ1bmN0aW9uKCkge307XG5cbi8vIHRoZSBmb3VuZEhlbHBlciByZWdpc3RlciB3aWxsIGRpc2FtYmlndWF0ZSBoZWxwZXIgbG9va3VwIGZyb20gZmluZGluZyBhXG4vLyBmdW5jdGlvbiBpbiBhIGNvbnRleHQuIFRoaXMgaXMgbmVjZXNzYXJ5IGZvciBtdXN0YWNoZSBjb21wYXRpYmlsaXR5LCB3aGljaFxuLy8gcmVxdWlyZXMgdGhhdCBjb250ZXh0IGZ1bmN0aW9ucyBpbiBibG9ja3MgYXJlIGV2YWx1YXRlZCBieSBibG9ja0hlbHBlck1pc3NpbmcsXG4vLyBhbmQgdGhlbiBwcm9jZWVkIGFzIGlmIHRoZSByZXN1bHRpbmcgdmFsdWUgd2FzIHByb3ZpZGVkIHRvIGJsb2NrSGVscGVyTWlzc2luZy5cblxuQ29tcGlsZXIucHJvdG90eXBlID0ge1xuICBjb21waWxlcjogQ29tcGlsZXIsXG5cbiAgZGlzYXNzZW1ibGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvcGNvZGVzID0gdGhpcy5vcGNvZGVzLCBvcGNvZGUsIG91dCA9IFtdLCBwYXJhbXMsIHBhcmFtO1xuXG4gICAgZm9yICh2YXIgaT0wLCBsPW9wY29kZXMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgb3Bjb2RlID0gb3Bjb2Rlc1tpXTtcblxuICAgICAgaWYgKG9wY29kZS5vcGNvZGUgPT09ICdERUNMQVJFJykge1xuICAgICAgICBvdXQucHVzaChcIkRFQ0xBUkUgXCIgKyBvcGNvZGUubmFtZSArIFwiPVwiICsgb3Bjb2RlLnZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcmFtcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBqPTA7IGo8b3Bjb2RlLmFyZ3MubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBwYXJhbSA9IG9wY29kZS5hcmdzW2pdO1xuICAgICAgICAgIGlmICh0eXBlb2YgcGFyYW0gPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIHBhcmFtID0gXCJcXFwiXCIgKyBwYXJhbS5yZXBsYWNlKFwiXFxuXCIsIFwiXFxcXG5cIikgKyBcIlxcXCJcIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcGFyYW1zLnB1c2gocGFyYW0pO1xuICAgICAgICB9XG4gICAgICAgIG91dC5wdXNoKG9wY29kZS5vcGNvZGUgKyBcIiBcIiArIHBhcmFtcy5qb2luKFwiIFwiKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG91dC5qb2luKFwiXFxuXCIpO1xuICB9LFxuICBlcXVhbHM6IGZ1bmN0aW9uKG90aGVyKSB7XG4gICAgdmFyIGxlbiA9IHRoaXMub3Bjb2Rlcy5sZW5ndGg7XG4gICAgaWYgKG90aGVyLm9wY29kZXMubGVuZ3RoICE9PSBsZW4pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIgb3Bjb2RlID0gdGhpcy5vcGNvZGVzW2ldLFxuICAgICAgICAgIG90aGVyT3Bjb2RlID0gb3RoZXIub3Bjb2Rlc1tpXTtcbiAgICAgIGlmIChvcGNvZGUub3Bjb2RlICE9PSBvdGhlck9wY29kZS5vcGNvZGUgfHwgb3Bjb2RlLmFyZ3MubGVuZ3RoICE9PSBvdGhlck9wY29kZS5hcmdzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG9wY29kZS5hcmdzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChvcGNvZGUuYXJnc1tqXSAhPT0gb3RoZXJPcGNvZGUuYXJnc1tqXSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGxlbiA9IHRoaXMuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIGlmIChvdGhlci5jaGlsZHJlbi5sZW5ndGggIT09IGxlbikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmICghdGhpcy5jaGlsZHJlbltpXS5lcXVhbHMob3RoZXIuY2hpbGRyZW5baV0pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcblxuICBndWlkOiAwLFxuXG4gIGNvbXBpbGU6IGZ1bmN0aW9uKHByb2dyYW0sIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgdGhpcy5kZXB0aHMgPSB7bGlzdDogW119O1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICAvLyBUaGVzZSBjaGFuZ2VzIHdpbGwgcHJvcGFnYXRlIHRvIHRoZSBvdGhlciBjb21waWxlciBjb21wb25lbnRzXG4gICAgdmFyIGtub3duSGVscGVycyA9IHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnM7XG4gICAgdGhpcy5vcHRpb25zLmtub3duSGVscGVycyA9IHtcbiAgICAgICdoZWxwZXJNaXNzaW5nJzogdHJ1ZSxcbiAgICAgICdibG9ja0hlbHBlck1pc3NpbmcnOiB0cnVlLFxuICAgICAgJ2VhY2gnOiB0cnVlLFxuICAgICAgJ2lmJzogdHJ1ZSxcbiAgICAgICd1bmxlc3MnOiB0cnVlLFxuICAgICAgJ3dpdGgnOiB0cnVlLFxuICAgICAgJ2xvZyc6IHRydWVcbiAgICB9O1xuICAgIGlmIChrbm93bkhlbHBlcnMpIHtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4ga25vd25IZWxwZXJzKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnNbbmFtZV0gPSBrbm93bkhlbHBlcnNbbmFtZV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMucHJvZ3JhbShwcm9ncmFtKTtcbiAgfSxcblxuICBhY2NlcHQ6IGZ1bmN0aW9uKG5vZGUpIHtcbiAgICByZXR1cm4gdGhpc1tub2RlLnR5cGVdKG5vZGUpO1xuICB9LFxuXG4gIHByb2dyYW06IGZ1bmN0aW9uKHByb2dyYW0pIHtcbiAgICB2YXIgc3RhdGVtZW50cyA9IHByb2dyYW0uc3RhdGVtZW50cywgc3RhdGVtZW50O1xuICAgIHRoaXMub3Bjb2RlcyA9IFtdO1xuXG4gICAgZm9yKHZhciBpPTAsIGw9c3RhdGVtZW50cy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBzdGF0ZW1lbnQgPSBzdGF0ZW1lbnRzW2ldO1xuICAgICAgdGhpc1tzdGF0ZW1lbnQudHlwZV0oc3RhdGVtZW50KTtcbiAgICB9XG4gICAgdGhpcy5pc1NpbXBsZSA9IGwgPT09IDE7XG5cbiAgICB0aGlzLmRlcHRocy5saXN0ID0gdGhpcy5kZXB0aHMubGlzdC5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgIHJldHVybiBhIC0gYjtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIGNvbXBpbGVQcm9ncmFtOiBmdW5jdGlvbihwcm9ncmFtKSB7XG4gICAgdmFyIHJlc3VsdCA9IG5ldyB0aGlzLmNvbXBpbGVyKCkuY29tcGlsZShwcm9ncmFtLCB0aGlzLm9wdGlvbnMpO1xuICAgIHZhciBndWlkID0gdGhpcy5ndWlkKyssIGRlcHRoO1xuXG4gICAgdGhpcy51c2VQYXJ0aWFsID0gdGhpcy51c2VQYXJ0aWFsIHx8IHJlc3VsdC51c2VQYXJ0aWFsO1xuXG4gICAgdGhpcy5jaGlsZHJlbltndWlkXSA9IHJlc3VsdDtcblxuICAgIGZvcih2YXIgaT0wLCBsPXJlc3VsdC5kZXB0aHMubGlzdC5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBkZXB0aCA9IHJlc3VsdC5kZXB0aHMubGlzdFtpXTtcblxuICAgICAgaWYoZGVwdGggPCAyKSB7IGNvbnRpbnVlOyB9XG4gICAgICBlbHNlIHsgdGhpcy5hZGREZXB0aChkZXB0aCAtIDEpOyB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGd1aWQ7XG4gIH0sXG5cbiAgYmxvY2s6IGZ1bmN0aW9uKGJsb2NrKSB7XG4gICAgdmFyIG11c3RhY2hlID0gYmxvY2subXVzdGFjaGUsXG4gICAgICAgIHByb2dyYW0gPSBibG9jay5wcm9ncmFtLFxuICAgICAgICBpbnZlcnNlID0gYmxvY2suaW52ZXJzZTtcblxuICAgIGlmIChwcm9ncmFtKSB7XG4gICAgICBwcm9ncmFtID0gdGhpcy5jb21waWxlUHJvZ3JhbShwcm9ncmFtKTtcbiAgICB9XG5cbiAgICBpZiAoaW52ZXJzZSkge1xuICAgICAgaW52ZXJzZSA9IHRoaXMuY29tcGlsZVByb2dyYW0oaW52ZXJzZSk7XG4gICAgfVxuXG4gICAgdmFyIHR5cGUgPSB0aGlzLmNsYXNzaWZ5TXVzdGFjaGUobXVzdGFjaGUpO1xuXG4gICAgaWYgKHR5cGUgPT09IFwiaGVscGVyXCIpIHtcbiAgICAgIHRoaXMuaGVscGVyTXVzdGFjaGUobXVzdGFjaGUsIHByb2dyYW0sIGludmVyc2UpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJzaW1wbGVcIikge1xuICAgICAgdGhpcy5zaW1wbGVNdXN0YWNoZShtdXN0YWNoZSk7XG5cbiAgICAgIC8vIG5vdyB0aGF0IHRoZSBzaW1wbGUgbXVzdGFjaGUgaXMgcmVzb2x2ZWQsIHdlIG5lZWQgdG9cbiAgICAgIC8vIGV2YWx1YXRlIGl0IGJ5IGV4ZWN1dGluZyBgYmxvY2tIZWxwZXJNaXNzaW5nYFxuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgcHJvZ3JhbSk7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdlbXB0eUhhc2gnKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdibG9ja1ZhbHVlJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYW1iaWd1b3VzTXVzdGFjaGUobXVzdGFjaGUsIHByb2dyYW0sIGludmVyc2UpO1xuXG4gICAgICAvLyBub3cgdGhhdCB0aGUgc2ltcGxlIG11c3RhY2hlIGlzIHJlc29sdmVkLCB3ZSBuZWVkIHRvXG4gICAgICAvLyBldmFsdWF0ZSBpdCBieSBleGVjdXRpbmcgYGJsb2NrSGVscGVyTWlzc2luZ2BcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHByb2dyYW0pO1xuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgaW52ZXJzZSk7XG4gICAgICB0aGlzLm9wY29kZSgnZW1wdHlIYXNoJyk7XG4gICAgICB0aGlzLm9wY29kZSgnYW1iaWd1b3VzQmxvY2tWYWx1ZScpO1xuICAgIH1cblxuICAgIHRoaXMub3Bjb2RlKCdhcHBlbmQnKTtcbiAgfSxcblxuICBoYXNoOiBmdW5jdGlvbihoYXNoKSB7XG4gICAgdmFyIHBhaXJzID0gaGFzaC5wYWlycywgcGFpciwgdmFsO1xuXG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hIYXNoJyk7XG5cbiAgICBmb3IodmFyIGk9MCwgbD1wYWlycy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBwYWlyID0gcGFpcnNbaV07XG4gICAgICB2YWwgID0gcGFpclsxXTtcblxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgICAgaWYodmFsLmRlcHRoKSB7XG4gICAgICAgICAgdGhpcy5hZGREZXB0aCh2YWwuZGVwdGgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgdmFsLmRlcHRoIHx8IDApO1xuICAgICAgICB0aGlzLm9wY29kZSgncHVzaFN0cmluZ1BhcmFtJywgdmFsLnN0cmluZ01vZGVWYWx1ZSwgdmFsLnR5cGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hY2NlcHQodmFsKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5vcGNvZGUoJ2Fzc2lnblRvSGFzaCcsIHBhaXJbMF0pO1xuICAgIH1cbiAgICB0aGlzLm9wY29kZSgncG9wSGFzaCcpO1xuICB9LFxuXG4gIHBhcnRpYWw6IGZ1bmN0aW9uKHBhcnRpYWwpIHtcbiAgICB2YXIgcGFydGlhbE5hbWUgPSBwYXJ0aWFsLnBhcnRpYWxOYW1lO1xuICAgIHRoaXMudXNlUGFydGlhbCA9IHRydWU7XG5cbiAgICBpZihwYXJ0aWFsLmNvbnRleHQpIHtcbiAgICAgIHRoaXMuSUQocGFydGlhbC5jb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2gnLCAnZGVwdGgwJyk7XG4gICAgfVxuXG4gICAgdGhpcy5vcGNvZGUoJ2ludm9rZVBhcnRpYWwnLCBwYXJ0aWFsTmFtZS5uYW1lKTtcbiAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XG4gIH0sXG5cbiAgY29udGVudDogZnVuY3Rpb24oY29udGVudCkge1xuICAgIHRoaXMub3Bjb2RlKCdhcHBlbmRDb250ZW50JywgY29udGVudC5zdHJpbmcpO1xuICB9LFxuXG4gIG11c3RhY2hlOiBmdW5jdGlvbihtdXN0YWNoZSkge1xuICAgIHZhciBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgIHZhciB0eXBlID0gdGhpcy5jbGFzc2lmeU11c3RhY2hlKG11c3RhY2hlKTtcblxuICAgIGlmICh0eXBlID09PSBcInNpbXBsZVwiKSB7XG4gICAgICB0aGlzLnNpbXBsZU11c3RhY2hlKG11c3RhY2hlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwiaGVscGVyXCIpIHtcbiAgICAgIHRoaXMuaGVscGVyTXVzdGFjaGUobXVzdGFjaGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFtYmlndW91c011c3RhY2hlKG11c3RhY2hlKTtcbiAgICB9XG5cbiAgICBpZihtdXN0YWNoZS5lc2NhcGVkICYmICFvcHRpb25zLm5vRXNjYXBlKSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kRXNjYXBlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XG4gICAgfVxuICB9LFxuXG4gIGFtYmlndW91c011c3RhY2hlOiBmdW5jdGlvbihtdXN0YWNoZSwgcHJvZ3JhbSwgaW52ZXJzZSkge1xuICAgIHZhciBpZCA9IG11c3RhY2hlLmlkLFxuICAgICAgICBuYW1lID0gaWQucGFydHNbMF0sXG4gICAgICAgIGlzQmxvY2sgPSBwcm9ncmFtICE9IG51bGwgfHwgaW52ZXJzZSAhPSBudWxsO1xuXG4gICAgdGhpcy5vcGNvZGUoJ2dldENvbnRleHQnLCBpZC5kZXB0aCk7XG5cbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcblxuICAgIHRoaXMub3Bjb2RlKCdpbnZva2VBbWJpZ3VvdXMnLCBuYW1lLCBpc0Jsb2NrKTtcbiAgfSxcblxuICBzaW1wbGVNdXN0YWNoZTogZnVuY3Rpb24obXVzdGFjaGUpIHtcbiAgICB2YXIgaWQgPSBtdXN0YWNoZS5pZDtcblxuICAgIGlmIChpZC50eXBlID09PSAnREFUQScpIHtcbiAgICAgIHRoaXMuREFUQShpZCk7XG4gICAgfSBlbHNlIGlmIChpZC5wYXJ0cy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuSUQoaWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTaW1wbGlmaWVkIElEIGZvciBgdGhpc2BcbiAgICAgIHRoaXMuYWRkRGVwdGgoaWQuZGVwdGgpO1xuICAgICAgdGhpcy5vcGNvZGUoJ2dldENvbnRleHQnLCBpZC5kZXB0aCk7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaENvbnRleHQnKTtcbiAgICB9XG5cbiAgICB0aGlzLm9wY29kZSgncmVzb2x2ZVBvc3NpYmxlTGFtYmRhJyk7XG4gIH0sXG5cbiAgaGVscGVyTXVzdGFjaGU6IGZ1bmN0aW9uKG11c3RhY2hlLCBwcm9ncmFtLCBpbnZlcnNlKSB7XG4gICAgdmFyIHBhcmFtcyA9IHRoaXMuc2V0dXBGdWxsTXVzdGFjaGVQYXJhbXMobXVzdGFjaGUsIHByb2dyYW0sIGludmVyc2UpLFxuICAgICAgICBuYW1lID0gbXVzdGFjaGUuaWQucGFydHNbMF07XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmtub3duSGVscGVyc1tuYW1lXSkge1xuICAgICAgdGhpcy5vcGNvZGUoJ2ludm9rZUtub3duSGVscGVyJywgcGFyYW1zLmxlbmd0aCwgbmFtZSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMua25vd25IZWxwZXJzT25seSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiWW91IHNwZWNpZmllZCBrbm93bkhlbHBlcnNPbmx5LCBidXQgdXNlZCB0aGUgdW5rbm93biBoZWxwZXIgXCIgKyBuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vcGNvZGUoJ2ludm9rZUhlbHBlcicsIHBhcmFtcy5sZW5ndGgsIG5hbWUpO1xuICAgIH1cbiAgfSxcblxuICBJRDogZnVuY3Rpb24oaWQpIHtcbiAgICB0aGlzLmFkZERlcHRoKGlkLmRlcHRoKTtcbiAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIGlkLmRlcHRoKTtcblxuICAgIHZhciBuYW1lID0gaWQucGFydHNbMF07XG4gICAgaWYgKCFuYW1lKSB7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaENvbnRleHQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vcGNvZGUoJ2xvb2t1cE9uQ29udGV4dCcsIGlkLnBhcnRzWzBdKTtcbiAgICB9XG5cbiAgICBmb3IodmFyIGk9MSwgbD1pZC5wYXJ0cy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICB0aGlzLm9wY29kZSgnbG9va3VwJywgaWQucGFydHNbaV0pO1xuICAgIH1cbiAgfSxcblxuICBEQVRBOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgdGhpcy5vcHRpb25zLmRhdGEgPSB0cnVlO1xuICAgIGlmIChkYXRhLmlkLmlzU2NvcGVkIHx8IGRhdGEuaWQuZGVwdGgpIHtcbiAgICAgIHRocm93IG5ldyBIYW5kbGViYXJzLkV4Y2VwdGlvbignU2NvcGVkIGRhdGEgcmVmZXJlbmNlcyBhcmUgbm90IHN1cHBvcnRlZDogJyArIGRhdGEub3JpZ2luYWwpO1xuICAgIH1cblxuICAgIHRoaXMub3Bjb2RlKCdsb29rdXBEYXRhJyk7XG4gICAgdmFyIHBhcnRzID0gZGF0YS5pZC5wYXJ0cztcbiAgICBmb3IodmFyIGk9MCwgbD1wYXJ0cy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICB0aGlzLm9wY29kZSgnbG9va3VwJywgcGFydHNbaV0pO1xuICAgIH1cbiAgfSxcblxuICBTVFJJTkc6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoU3RyaW5nJywgc3RyaW5nLnN0cmluZyk7XG4gIH0sXG5cbiAgSU5URUdFUjogZnVuY3Rpb24oaW50ZWdlcikge1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoTGl0ZXJhbCcsIGludGVnZXIuaW50ZWdlcik7XG4gIH0sXG5cbiAgQk9PTEVBTjogZnVuY3Rpb24oYm9vbCkge1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoTGl0ZXJhbCcsIGJvb2wuYm9vbCk7XG4gIH0sXG5cbiAgY29tbWVudDogZnVuY3Rpb24oKSB7fSxcblxuICAvLyBIRUxQRVJTXG4gIG9wY29kZTogZnVuY3Rpb24obmFtZSkge1xuICAgIHRoaXMub3Bjb2Rlcy5wdXNoKHsgb3Bjb2RlOiBuYW1lLCBhcmdzOiBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkgfSk7XG4gIH0sXG5cbiAgZGVjbGFyZTogZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICB0aGlzLm9wY29kZXMucHVzaCh7IG9wY29kZTogJ0RFQ0xBUkUnLCBuYW1lOiBuYW1lLCB2YWx1ZTogdmFsdWUgfSk7XG4gIH0sXG5cbiAgYWRkRGVwdGg6IGZ1bmN0aW9uKGRlcHRoKSB7XG4gICAgaWYoaXNOYU4oZGVwdGgpKSB7IHRocm93IG5ldyBFcnJvcihcIkVXT1RcIik7IH1cbiAgICBpZihkZXB0aCA9PT0gMCkgeyByZXR1cm47IH1cblxuICAgIGlmKCF0aGlzLmRlcHRoc1tkZXB0aF0pIHtcbiAgICAgIHRoaXMuZGVwdGhzW2RlcHRoXSA9IHRydWU7XG4gICAgICB0aGlzLmRlcHRocy5saXN0LnB1c2goZGVwdGgpO1xuICAgIH1cbiAgfSxcblxuICBjbGFzc2lmeU11c3RhY2hlOiBmdW5jdGlvbihtdXN0YWNoZSkge1xuICAgIHZhciBpc0hlbHBlciAgID0gbXVzdGFjaGUuaXNIZWxwZXI7XG4gICAgdmFyIGlzRWxpZ2libGUgPSBtdXN0YWNoZS5lbGlnaWJsZUhlbHBlcjtcbiAgICB2YXIgb3B0aW9ucyAgICA9IHRoaXMub3B0aW9ucztcblxuICAgIC8vIGlmIGFtYmlndW91cywgd2UgY2FuIHBvc3NpYmx5IHJlc29sdmUgdGhlIGFtYmlndWl0eSBub3dcbiAgICBpZiAoaXNFbGlnaWJsZSAmJiAhaXNIZWxwZXIpIHtcbiAgICAgIHZhciBuYW1lID0gbXVzdGFjaGUuaWQucGFydHNbMF07XG5cbiAgICAgIGlmIChvcHRpb25zLmtub3duSGVscGVyc1tuYW1lXSkge1xuICAgICAgICBpc0hlbHBlciA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKG9wdGlvbnMua25vd25IZWxwZXJzT25seSkge1xuICAgICAgICBpc0VsaWdpYmxlID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGlzSGVscGVyKSB7IHJldHVybiBcImhlbHBlclwiOyB9XG4gICAgZWxzZSBpZiAoaXNFbGlnaWJsZSkgeyByZXR1cm4gXCJhbWJpZ3VvdXNcIjsgfVxuICAgIGVsc2UgeyByZXR1cm4gXCJzaW1wbGVcIjsgfVxuICB9LFxuXG4gIHB1c2hQYXJhbXM6IGZ1bmN0aW9uKHBhcmFtcykge1xuICAgIHZhciBpID0gcGFyYW1zLmxlbmd0aCwgcGFyYW07XG5cbiAgICB3aGlsZShpLS0pIHtcbiAgICAgIHBhcmFtID0gcGFyYW1zW2ldO1xuXG4gICAgICBpZih0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICAgIGlmKHBhcmFtLmRlcHRoKSB7XG4gICAgICAgICAgdGhpcy5hZGREZXB0aChwYXJhbS5kZXB0aCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIHBhcmFtLmRlcHRoIHx8IDApO1xuICAgICAgICB0aGlzLm9wY29kZSgncHVzaFN0cmluZ1BhcmFtJywgcGFyYW0uc3RyaW5nTW9kZVZhbHVlLCBwYXJhbS50eXBlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXNbcGFyYW0udHlwZV0ocGFyYW0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBzZXR1cE11c3RhY2hlUGFyYW1zOiBmdW5jdGlvbihtdXN0YWNoZSkge1xuICAgIHZhciBwYXJhbXMgPSBtdXN0YWNoZS5wYXJhbXM7XG4gICAgdGhpcy5wdXNoUGFyYW1zKHBhcmFtcyk7XG5cbiAgICBpZihtdXN0YWNoZS5oYXNoKSB7XG4gICAgICB0aGlzLmhhc2gobXVzdGFjaGUuaGFzaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdlbXB0eUhhc2gnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyYW1zO1xuICB9LFxuXG4gIC8vIHRoaXMgd2lsbCByZXBsYWNlIHNldHVwTXVzdGFjaGVQYXJhbXMgd2hlbiB3ZSdyZSBkb25lXG4gIHNldHVwRnVsbE11c3RhY2hlUGFyYW1zOiBmdW5jdGlvbihtdXN0YWNoZSwgcHJvZ3JhbSwgaW52ZXJzZSkge1xuICAgIHZhciBwYXJhbXMgPSBtdXN0YWNoZS5wYXJhbXM7XG4gICAgdGhpcy5wdXNoUGFyYW1zKHBhcmFtcyk7XG5cbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcbiAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBpbnZlcnNlKTtcblxuICAgIGlmKG11c3RhY2hlLmhhc2gpIHtcbiAgICAgIHRoaXMuaGFzaChtdXN0YWNoZS5oYXNoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vcGNvZGUoJ2VtcHR5SGFzaCcpO1xuICAgIH1cblxuICAgIHJldHVybiBwYXJhbXM7XG4gIH1cbn07XG5cbnZhciBMaXRlcmFsID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgdGhpcy52YWx1ZSA9IHZhbHVlO1xufTtcblxuSmF2YVNjcmlwdENvbXBpbGVyLnByb3RvdHlwZSA9IHtcbiAgLy8gUFVCTElDIEFQSTogWW91IGNhbiBvdmVycmlkZSB0aGVzZSBtZXRob2RzIGluIGEgc3ViY2xhc3MgdG8gcHJvdmlkZVxuICAvLyBhbHRlcm5hdGl2ZSBjb21waWxlZCBmb3JtcyBmb3IgbmFtZSBsb29rdXAgYW5kIGJ1ZmZlcmluZyBzZW1hbnRpY3NcbiAgbmFtZUxvb2t1cDogZnVuY3Rpb24ocGFyZW50LCBuYW1lIC8qICwgdHlwZSovKSB7XG4gICAgaWYgKC9eWzAtOV0rJC8udGVzdChuYW1lKSkge1xuICAgICAgcmV0dXJuIHBhcmVudCArIFwiW1wiICsgbmFtZSArIFwiXVwiO1xuICAgIH0gZWxzZSBpZiAoSmF2YVNjcmlwdENvbXBpbGVyLmlzVmFsaWRKYXZhU2NyaXB0VmFyaWFibGVOYW1lKG5hbWUpKSB7XG4gICAgICByZXR1cm4gcGFyZW50ICsgXCIuXCIgKyBuYW1lO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiBwYXJlbnQgKyBcIlsnXCIgKyBuYW1lICsgXCInXVwiO1xuICAgIH1cbiAgfSxcblxuICBhcHBlbmRUb0J1ZmZlcjogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuZW52aXJvbm1lbnQuaXNTaW1wbGUpIHtcbiAgICAgIHJldHVybiBcInJldHVybiBcIiArIHN0cmluZyArIFwiO1wiO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBhcHBlbmRUb0J1ZmZlcjogdHJ1ZSxcbiAgICAgICAgY29udGVudDogc3RyaW5nLFxuICAgICAgICB0b1N0cmluZzogZnVuY3Rpb24oKSB7IHJldHVybiBcImJ1ZmZlciArPSBcIiArIHN0cmluZyArIFwiO1wiOyB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuICBpbml0aWFsaXplQnVmZmVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5xdW90ZWRTdHJpbmcoXCJcIik7XG4gIH0sXG5cbiAgbmFtZXNwYWNlOiBcIkhhbmRsZWJhcnNcIixcbiAgLy8gRU5EIFBVQkxJQyBBUElcblxuICBjb21waWxlOiBmdW5jdGlvbihlbnZpcm9ubWVudCwgb3B0aW9ucywgY29udGV4dCwgYXNPYmplY3QpIHtcbiAgICB0aGlzLmVudmlyb25tZW50ID0gZW52aXJvbm1lbnQ7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIEhhbmRsZWJhcnMubG9nKEhhbmRsZWJhcnMubG9nZ2VyLkRFQlVHLCB0aGlzLmVudmlyb25tZW50LmRpc2Fzc2VtYmxlKCkgKyBcIlxcblxcblwiKTtcblxuICAgIHRoaXMubmFtZSA9IHRoaXMuZW52aXJvbm1lbnQubmFtZTtcbiAgICB0aGlzLmlzQ2hpbGQgPSAhIWNvbnRleHQ7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dCB8fCB7XG4gICAgICBwcm9ncmFtczogW10sXG4gICAgICBlbnZpcm9ubWVudHM6IFtdLFxuICAgICAgYWxpYXNlczogeyB9XG4gICAgfTtcblxuICAgIHRoaXMucHJlYW1ibGUoKTtcblxuICAgIHRoaXMuc3RhY2tTbG90ID0gMDtcbiAgICB0aGlzLnN0YWNrVmFycyA9IFtdO1xuICAgIHRoaXMucmVnaXN0ZXJzID0geyBsaXN0OiBbXSB9O1xuICAgIHRoaXMuY29tcGlsZVN0YWNrID0gW107XG4gICAgdGhpcy5pbmxpbmVTdGFjayA9IFtdO1xuXG4gICAgdGhpcy5jb21waWxlQ2hpbGRyZW4oZW52aXJvbm1lbnQsIG9wdGlvbnMpO1xuXG4gICAgdmFyIG9wY29kZXMgPSBlbnZpcm9ubWVudC5vcGNvZGVzLCBvcGNvZGU7XG5cbiAgICB0aGlzLmkgPSAwO1xuXG4gICAgZm9yKGw9b3Bjb2Rlcy5sZW5ndGg7IHRoaXMuaTxsOyB0aGlzLmkrKykge1xuICAgICAgb3Bjb2RlID0gb3Bjb2Rlc1t0aGlzLmldO1xuXG4gICAgICBpZihvcGNvZGUub3Bjb2RlID09PSAnREVDTEFSRScpIHtcbiAgICAgICAgdGhpc1tvcGNvZGUubmFtZV0gPSBvcGNvZGUudmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzW29wY29kZS5vcGNvZGVdLmFwcGx5KHRoaXMsIG9wY29kZS5hcmdzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5jcmVhdGVGdW5jdGlvbkNvbnRleHQoYXNPYmplY3QpO1xuICB9LFxuXG4gIG5leHRPcGNvZGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvcGNvZGVzID0gdGhpcy5lbnZpcm9ubWVudC5vcGNvZGVzO1xuICAgIHJldHVybiBvcGNvZGVzW3RoaXMuaSArIDFdO1xuICB9LFxuXG4gIGVhdDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5pID0gdGhpcy5pICsgMTtcbiAgfSxcblxuICBwcmVhbWJsZTogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG91dCA9IFtdO1xuXG4gICAgaWYgKCF0aGlzLmlzQ2hpbGQpIHtcbiAgICAgIHZhciBuYW1lc3BhY2UgPSB0aGlzLm5hbWVzcGFjZTtcblxuICAgICAgdmFyIGNvcGllcyA9IFwiaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgXCIgKyBuYW1lc3BhY2UgKyBcIi5oZWxwZXJzKTtcIjtcbiAgICAgIGlmICh0aGlzLmVudmlyb25tZW50LnVzZVBhcnRpYWwpIHsgY29waWVzID0gY29waWVzICsgXCIgcGFydGlhbHMgPSB0aGlzLm1lcmdlKHBhcnRpYWxzLCBcIiArIG5hbWVzcGFjZSArIFwiLnBhcnRpYWxzKTtcIjsgfVxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5kYXRhKSB7IGNvcGllcyA9IGNvcGllcyArIFwiIGRhdGEgPSBkYXRhIHx8IHt9O1wiOyB9XG4gICAgICBvdXQucHVzaChjb3BpZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXQucHVzaCgnJyk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmVudmlyb25tZW50LmlzU2ltcGxlKSB7XG4gICAgICBvdXQucHVzaChcIiwgYnVmZmVyID0gXCIgKyB0aGlzLmluaXRpYWxpemVCdWZmZXIoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dC5wdXNoKFwiXCIpO1xuICAgIH1cblxuICAgIC8vIHRyYWNrIHRoZSBsYXN0IGNvbnRleHQgcHVzaGVkIGludG8gcGxhY2UgdG8gYWxsb3cgc2tpcHBpbmcgdGhlXG4gICAgLy8gZ2V0Q29udGV4dCBvcGNvZGUgd2hlbiBpdCB3b3VsZCBiZSBhIG5vb3BcbiAgICB0aGlzLmxhc3RDb250ZXh0ID0gMDtcbiAgICB0aGlzLnNvdXJjZSA9IG91dDtcbiAgfSxcblxuICBjcmVhdGVGdW5jdGlvbkNvbnRleHQ6IGZ1bmN0aW9uKGFzT2JqZWN0KSB7XG4gICAgdmFyIGxvY2FscyA9IHRoaXMuc3RhY2tWYXJzLmNvbmNhdCh0aGlzLnJlZ2lzdGVycy5saXN0KTtcblxuICAgIGlmKGxvY2Fscy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnNvdXJjZVsxXSA9IHRoaXMuc291cmNlWzFdICsgXCIsIFwiICsgbG9jYWxzLmpvaW4oXCIsIFwiKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSBtaW5pbWl6ZXIgYWxpYXMgbWFwcGluZ3NcbiAgICBpZiAoIXRoaXMuaXNDaGlsZCkge1xuICAgICAgZm9yICh2YXIgYWxpYXMgaW4gdGhpcy5jb250ZXh0LmFsaWFzZXMpIHtcbiAgICAgICAgaWYgKHRoaXMuY29udGV4dC5hbGlhc2VzLmhhc093blByb3BlcnR5KGFsaWFzKSkge1xuICAgICAgICAgIHRoaXMuc291cmNlWzFdID0gdGhpcy5zb3VyY2VbMV0gKyAnLCAnICsgYWxpYXMgKyAnPScgKyB0aGlzLmNvbnRleHQuYWxpYXNlc1thbGlhc107XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5zb3VyY2VbMV0pIHtcbiAgICAgIHRoaXMuc291cmNlWzFdID0gXCJ2YXIgXCIgKyB0aGlzLnNvdXJjZVsxXS5zdWJzdHJpbmcoMikgKyBcIjtcIjtcbiAgICB9XG5cbiAgICAvLyBNZXJnZSBjaGlsZHJlblxuICAgIGlmICghdGhpcy5pc0NoaWxkKSB7XG4gICAgICB0aGlzLnNvdXJjZVsxXSArPSAnXFxuJyArIHRoaXMuY29udGV4dC5wcm9ncmFtcy5qb2luKCdcXG4nKSArICdcXG4nO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSkge1xuICAgICAgdGhpcy5zb3VyY2UucHVzaChcInJldHVybiBidWZmZXI7XCIpO1xuICAgIH1cblxuICAgIHZhciBwYXJhbXMgPSB0aGlzLmlzQ2hpbGQgPyBbXCJkZXB0aDBcIiwgXCJkYXRhXCJdIDogW1wiSGFuZGxlYmFyc1wiLCBcImRlcHRoMFwiLCBcImhlbHBlcnNcIiwgXCJwYXJ0aWFsc1wiLCBcImRhdGFcIl07XG5cbiAgICBmb3IodmFyIGk9MCwgbD10aGlzLmVudmlyb25tZW50LmRlcHRocy5saXN0Lmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIHBhcmFtcy5wdXNoKFwiZGVwdGhcIiArIHRoaXMuZW52aXJvbm1lbnQuZGVwdGhzLmxpc3RbaV0pO1xuICAgIH1cblxuICAgIC8vIFBlcmZvcm0gYSBzZWNvbmQgcGFzcyBvdmVyIHRoZSBvdXRwdXQgdG8gbWVyZ2UgY29udGVudCB3aGVuIHBvc3NpYmxlXG4gICAgdmFyIHNvdXJjZSA9IHRoaXMubWVyZ2VTb3VyY2UoKTtcblxuICAgIGlmICghdGhpcy5pc0NoaWxkKSB7XG4gICAgICB2YXIgcmV2aXNpb24gPSBIYW5kbGViYXJzLkNPTVBJTEVSX1JFVklTSU9OLFxuICAgICAgICAgIHZlcnNpb25zID0gSGFuZGxlYmFycy5SRVZJU0lPTl9DSEFOR0VTW3JldmlzaW9uXTtcbiAgICAgIHNvdXJjZSA9IFwidGhpcy5jb21waWxlckluZm8gPSBbXCIrcmV2aXNpb24rXCIsJ1wiK3ZlcnNpb25zK1wiJ107XFxuXCIrc291cmNlO1xuICAgIH1cblxuICAgIGlmIChhc09iamVjdCkge1xuICAgICAgcGFyYW1zLnB1c2goc291cmNlKTtcblxuICAgICAgcmV0dXJuIEZ1bmN0aW9uLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBmdW5jdGlvblNvdXJjZSA9ICdmdW5jdGlvbiAnICsgKHRoaXMubmFtZSB8fCAnJykgKyAnKCcgKyBwYXJhbXMuam9pbignLCcpICsgJykge1xcbiAgJyArIHNvdXJjZSArICd9JztcbiAgICAgIEhhbmRsZWJhcnMubG9nKEhhbmRsZWJhcnMubG9nZ2VyLkRFQlVHLCBmdW5jdGlvblNvdXJjZSArIFwiXFxuXFxuXCIpO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uU291cmNlO1xuICAgIH1cbiAgfSxcbiAgbWVyZ2VTb3VyY2U6IGZ1bmN0aW9uKCkge1xuICAgIC8vIFdBUk46IFdlIGFyZSBub3QgaGFuZGxpbmcgdGhlIGNhc2Ugd2hlcmUgYnVmZmVyIGlzIHN0aWxsIHBvcHVsYXRlZCBhcyB0aGUgc291cmNlIHNob3VsZFxuICAgIC8vIG5vdCBoYXZlIGJ1ZmZlciBhcHBlbmQgb3BlcmF0aW9ucyBhcyB0aGVpciBmaW5hbCBhY3Rpb24uXG4gICAgdmFyIHNvdXJjZSA9ICcnLFxuICAgICAgICBidWZmZXI7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRoaXMuc291cmNlLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIgbGluZSA9IHRoaXMuc291cmNlW2ldO1xuICAgICAgaWYgKGxpbmUuYXBwZW5kVG9CdWZmZXIpIHtcbiAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgIGJ1ZmZlciA9IGJ1ZmZlciArICdcXG4gICAgKyAnICsgbGluZS5jb250ZW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJ1ZmZlciA9IGxpbmUuY29udGVudDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgIHNvdXJjZSArPSAnYnVmZmVyICs9ICcgKyBidWZmZXIgKyAnO1xcbiAgJztcbiAgICAgICAgICBidWZmZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlICs9IGxpbmUgKyAnXFxuICAnO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc291cmNlO1xuICB9LFxuXG4gIC8vIFtibG9ja1ZhbHVlXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCB2YWx1ZVxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHJldHVybiB2YWx1ZSBvZiBibG9ja0hlbHBlck1pc3NpbmdcbiAgLy9cbiAgLy8gVGhlIHB1cnBvc2Ugb2YgdGhpcyBvcGNvZGUgaXMgdG8gdGFrZSBhIGJsb2NrIG9mIHRoZSBmb3JtXG4gIC8vIGB7eyNmb299fS4uLnt7L2Zvb319YCwgcmVzb2x2ZSB0aGUgdmFsdWUgb2YgYGZvb2AsIGFuZFxuICAvLyByZXBsYWNlIGl0IG9uIHRoZSBzdGFjayB3aXRoIHRoZSByZXN1bHQgb2YgcHJvcGVybHlcbiAgLy8gaW52b2tpbmcgYmxvY2tIZWxwZXJNaXNzaW5nLlxuICBibG9ja1ZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5ibG9ja0hlbHBlck1pc3NpbmcgPSAnaGVscGVycy5ibG9ja0hlbHBlck1pc3NpbmcnO1xuXG4gICAgdmFyIHBhcmFtcyA9IFtcImRlcHRoMFwiXTtcbiAgICB0aGlzLnNldHVwUGFyYW1zKDAsIHBhcmFtcyk7XG5cbiAgICB0aGlzLnJlcGxhY2VTdGFjayhmdW5jdGlvbihjdXJyZW50KSB7XG4gICAgICBwYXJhbXMuc3BsaWNlKDEsIDAsIGN1cnJlbnQpO1xuICAgICAgcmV0dXJuIFwiYmxvY2tIZWxwZXJNaXNzaW5nLmNhbGwoXCIgKyBwYXJhbXMuam9pbihcIiwgXCIpICsgXCIpXCI7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gW2FtYmlndW91c0Jsb2NrVmFsdWVdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHZhbHVlXG4gIC8vIENvbXBpbGVyIHZhbHVlLCBiZWZvcmU6IGxhc3RIZWxwZXI9dmFsdWUgb2YgbGFzdCBmb3VuZCBoZWxwZXIsIGlmIGFueVxuICAvLyBPbiBzdGFjaywgYWZ0ZXIsIGlmIG5vIGxhc3RIZWxwZXI6IHNhbWUgYXMgW2Jsb2NrVmFsdWVdXG4gIC8vIE9uIHN0YWNrLCBhZnRlciwgaWYgbGFzdEhlbHBlcjogdmFsdWVcbiAgYW1iaWd1b3VzQmxvY2tWYWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuYmxvY2tIZWxwZXJNaXNzaW5nID0gJ2hlbHBlcnMuYmxvY2tIZWxwZXJNaXNzaW5nJztcblxuICAgIHZhciBwYXJhbXMgPSBbXCJkZXB0aDBcIl07XG4gICAgdGhpcy5zZXR1cFBhcmFtcygwLCBwYXJhbXMpO1xuXG4gICAgdmFyIGN1cnJlbnQgPSB0aGlzLnRvcFN0YWNrKCk7XG4gICAgcGFyYW1zLnNwbGljZSgxLCAwLCBjdXJyZW50KTtcblxuICAgIC8vIFVzZSB0aGUgb3B0aW9ucyB2YWx1ZSBnZW5lcmF0ZWQgZnJvbSB0aGUgaW52b2NhdGlvblxuICAgIHBhcmFtc1twYXJhbXMubGVuZ3RoLTFdID0gJ29wdGlvbnMnO1xuXG4gICAgdGhpcy5zb3VyY2UucHVzaChcImlmICghXCIgKyB0aGlzLmxhc3RIZWxwZXIgKyBcIikgeyBcIiArIGN1cnJlbnQgKyBcIiA9IGJsb2NrSGVscGVyTWlzc2luZy5jYWxsKFwiICsgcGFyYW1zLmpvaW4oXCIsIFwiKSArIFwiKTsgfVwiKTtcbiAgfSxcblxuICAvLyBbYXBwZW5kQ29udGVudF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXG4gIC8vXG4gIC8vIEFwcGVuZHMgdGhlIHN0cmluZyB2YWx1ZSBvZiBgY29udGVudGAgdG8gdGhlIGN1cnJlbnQgYnVmZmVyXG4gIGFwcGVuZENvbnRlbnQ6IGZ1bmN0aW9uKGNvbnRlbnQpIHtcbiAgICB0aGlzLnNvdXJjZS5wdXNoKHRoaXMuYXBwZW5kVG9CdWZmZXIodGhpcy5xdW90ZWRTdHJpbmcoY29udGVudCkpKTtcbiAgfSxcblxuICAvLyBbYXBwZW5kXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXG4gIC8vXG4gIC8vIENvZXJjZXMgYHZhbHVlYCB0byBhIFN0cmluZyBhbmQgYXBwZW5kcyBpdCB0byB0aGUgY3VycmVudCBidWZmZXIuXG4gIC8vXG4gIC8vIElmIGB2YWx1ZWAgaXMgdHJ1dGh5LCBvciAwLCBpdCBpcyBjb2VyY2VkIGludG8gYSBzdHJpbmcgYW5kIGFwcGVuZGVkXG4gIC8vIE90aGVyd2lzZSwgdGhlIGVtcHR5IHN0cmluZyBpcyBhcHBlbmRlZFxuICBhcHBlbmQ6IGZ1bmN0aW9uKCkge1xuICAgIC8vIEZvcmNlIGFueXRoaW5nIHRoYXQgaXMgaW5saW5lZCBvbnRvIHRoZSBzdGFjayBzbyB3ZSBkb24ndCBoYXZlIGR1cGxpY2F0aW9uXG4gICAgLy8gd2hlbiB3ZSBleGFtaW5lIGxvY2FsXG4gICAgdGhpcy5mbHVzaElubGluZSgpO1xuICAgIHZhciBsb2NhbCA9IHRoaXMucG9wU3RhY2soKTtcbiAgICB0aGlzLnNvdXJjZS5wdXNoKFwiaWYoXCIgKyBsb2NhbCArIFwiIHx8IFwiICsgbG9jYWwgKyBcIiA9PT0gMCkgeyBcIiArIHRoaXMuYXBwZW5kVG9CdWZmZXIobG9jYWwpICsgXCIgfVwiKTtcbiAgICBpZiAodGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSkge1xuICAgICAgdGhpcy5zb3VyY2UucHVzaChcImVsc2UgeyBcIiArIHRoaXMuYXBwZW5kVG9CdWZmZXIoXCInJ1wiKSArIFwiIH1cIik7XG4gICAgfVxuICB9LFxuXG4gIC8vIFthcHBlbmRFc2NhcGVkXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXG4gIC8vXG4gIC8vIEVzY2FwZSBgdmFsdWVgIGFuZCBhcHBlbmQgaXQgdG8gdGhlIGJ1ZmZlclxuICBhcHBlbmRFc2NhcGVkOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5lc2NhcGVFeHByZXNzaW9uID0gJ3RoaXMuZXNjYXBlRXhwcmVzc2lvbic7XG5cbiAgICB0aGlzLnNvdXJjZS5wdXNoKHRoaXMuYXBwZW5kVG9CdWZmZXIoXCJlc2NhcGVFeHByZXNzaW9uKFwiICsgdGhpcy5wb3BTdGFjaygpICsgXCIpXCIpKTtcbiAgfSxcblxuICAvLyBbZ2V0Q29udGV4dF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXG4gIC8vIENvbXBpbGVyIHZhbHVlLCBhZnRlcjogbGFzdENvbnRleHQ9ZGVwdGhcbiAgLy9cbiAgLy8gU2V0IHRoZSB2YWx1ZSBvZiB0aGUgYGxhc3RDb250ZXh0YCBjb21waWxlciB2YWx1ZSB0byB0aGUgZGVwdGhcbiAgZ2V0Q29udGV4dDogZnVuY3Rpb24oZGVwdGgpIHtcbiAgICBpZih0aGlzLmxhc3RDb250ZXh0ICE9PSBkZXB0aCkge1xuICAgICAgdGhpcy5sYXN0Q29udGV4dCA9IGRlcHRoO1xuICAgIH1cbiAgfSxcblxuICAvLyBbbG9va3VwT25Db250ZXh0XVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBjdXJyZW50Q29udGV4dFtuYW1lXSwgLi4uXG4gIC8vXG4gIC8vIExvb2tzIHVwIHRoZSB2YWx1ZSBvZiBgbmFtZWAgb24gdGhlIGN1cnJlbnQgY29udGV4dCBhbmQgcHVzaGVzXG4gIC8vIGl0IG9udG8gdGhlIHN0YWNrLlxuICBsb29rdXBPbkNvbnRleHQ6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB0aGlzLnB1c2godGhpcy5uYW1lTG9va3VwKCdkZXB0aCcgKyB0aGlzLmxhc3RDb250ZXh0LCBuYW1lLCAnY29udGV4dCcpKTtcbiAgfSxcblxuICAvLyBbcHVzaENvbnRleHRdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IGN1cnJlbnRDb250ZXh0LCAuLi5cbiAgLy9cbiAgLy8gUHVzaGVzIHRoZSB2YWx1ZSBvZiB0aGUgY3VycmVudCBjb250ZXh0IG9udG8gdGhlIHN0YWNrLlxuICBwdXNoQ29udGV4dDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKCdkZXB0aCcgKyB0aGlzLmxhc3RDb250ZXh0KTtcbiAgfSxcblxuICAvLyBbcmVzb2x2ZVBvc3NpYmxlTGFtYmRhXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmVzb2x2ZWQgdmFsdWUsIC4uLlxuICAvL1xuICAvLyBJZiB0aGUgYHZhbHVlYCBpcyBhIGxhbWJkYSwgcmVwbGFjZSBpdCBvbiB0aGUgc3RhY2sgYnlcbiAgLy8gdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgbGFtYmRhXG4gIHJlc29sdmVQb3NzaWJsZUxhbWJkYTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuZnVuY3Rpb25UeXBlID0gJ1wiZnVuY3Rpb25cIic7XG5cbiAgICB0aGlzLnJlcGxhY2VTdGFjayhmdW5jdGlvbihjdXJyZW50KSB7XG4gICAgICByZXR1cm4gXCJ0eXBlb2YgXCIgKyBjdXJyZW50ICsgXCIgPT09IGZ1bmN0aW9uVHlwZSA/IFwiICsgY3VycmVudCArIFwiLmFwcGx5KGRlcHRoMCkgOiBcIiArIGN1cnJlbnQ7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gW2xvb2t1cF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHZhbHVlW25hbWVdLCAuLi5cbiAgLy9cbiAgLy8gUmVwbGFjZSB0aGUgdmFsdWUgb24gdGhlIHN0YWNrIHdpdGggdGhlIHJlc3VsdCBvZiBsb29raW5nXG4gIC8vIHVwIGBuYW1lYCBvbiBgdmFsdWVgXG4gIGxvb2t1cDogZnVuY3Rpb24obmFtZSkge1xuICAgIHRoaXMucmVwbGFjZVN0YWNrKGZ1bmN0aW9uKGN1cnJlbnQpIHtcbiAgICAgIHJldHVybiBjdXJyZW50ICsgXCIgPT0gbnVsbCB8fCBcIiArIGN1cnJlbnQgKyBcIiA9PT0gZmFsc2UgPyBcIiArIGN1cnJlbnQgKyBcIiA6IFwiICsgdGhpcy5uYW1lTG9va3VwKGN1cnJlbnQsIG5hbWUsICdjb250ZXh0Jyk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gW2xvb2t1cERhdGFdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IGRhdGFbaWRdLCAuLi5cbiAgLy9cbiAgLy8gUHVzaCB0aGUgcmVzdWx0IG9mIGxvb2tpbmcgdXAgYGlkYCBvbiB0aGUgY3VycmVudCBkYXRhXG4gIGxvb2t1cERhdGE6IGZ1bmN0aW9uKGlkKSB7XG4gICAgdGhpcy5wdXNoKCdkYXRhJyk7XG4gIH0sXG5cbiAgLy8gW3B1c2hTdHJpbmdQYXJhbV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogc3RyaW5nLCBjdXJyZW50Q29udGV4dCwgLi4uXG4gIC8vXG4gIC8vIFRoaXMgb3Bjb2RlIGlzIGRlc2lnbmVkIGZvciB1c2UgaW4gc3RyaW5nIG1vZGUsIHdoaWNoXG4gIC8vIHByb3ZpZGVzIHRoZSBzdHJpbmcgdmFsdWUgb2YgYSBwYXJhbWV0ZXIgYWxvbmcgd2l0aCBpdHNcbiAgLy8gZGVwdGggcmF0aGVyIHRoYW4gcmVzb2x2aW5nIGl0IGltbWVkaWF0ZWx5LlxuICBwdXNoU3RyaW5nUGFyYW06IGZ1bmN0aW9uKHN0cmluZywgdHlwZSkge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCgnZGVwdGgnICsgdGhpcy5sYXN0Q29udGV4dCk7XG5cbiAgICB0aGlzLnB1c2hTdHJpbmcodHlwZSk7XG5cbiAgICBpZiAodHlwZW9mIHN0cmluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMucHVzaFN0cmluZyhzdHJpbmcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoc3RyaW5nKTtcbiAgICB9XG4gIH0sXG5cbiAgZW1wdHlIYXNoOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoJ3t9Jyk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgdGhpcy5yZWdpc3RlcignaGFzaFR5cGVzJywgJ3t9Jyk7XG4gICAgICB0aGlzLnJlZ2lzdGVyKCdoYXNoQ29udGV4dHMnLCAne30nKTtcbiAgICB9XG4gIH0sXG4gIHB1c2hIYXNoOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmhhc2ggPSB7dmFsdWVzOiBbXSwgdHlwZXM6IFtdLCBjb250ZXh0czogW119O1xuICB9LFxuICBwb3BIYXNoOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaGFzaCA9IHRoaXMuaGFzaDtcbiAgICB0aGlzLmhhc2ggPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgdGhpcy5yZWdpc3RlcignaGFzaENvbnRleHRzJywgJ3snICsgaGFzaC5jb250ZXh0cy5qb2luKCcsJykgKyAnfScpO1xuICAgICAgdGhpcy5yZWdpc3RlcignaGFzaFR5cGVzJywgJ3snICsgaGFzaC50eXBlcy5qb2luKCcsJykgKyAnfScpO1xuICAgIH1cbiAgICB0aGlzLnB1c2goJ3tcXG4gICAgJyArIGhhc2gudmFsdWVzLmpvaW4oJyxcXG4gICAgJykgKyAnXFxuICB9Jyk7XG4gIH0sXG5cbiAgLy8gW3B1c2hTdHJpbmddXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHF1b3RlZFN0cmluZyhzdHJpbmcpLCAuLi5cbiAgLy9cbiAgLy8gUHVzaCBhIHF1b3RlZCB2ZXJzaW9uIG9mIGBzdHJpbmdgIG9udG8gdGhlIHN0YWNrXG4gIHB1c2hTdHJpbmc6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCh0aGlzLnF1b3RlZFN0cmluZyhzdHJpbmcpKTtcbiAgfSxcblxuICAvLyBbcHVzaF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogZXhwciwgLi4uXG4gIC8vXG4gIC8vIFB1c2ggYW4gZXhwcmVzc2lvbiBvbnRvIHRoZSBzdGFja1xuICBwdXNoOiBmdW5jdGlvbihleHByKSB7XG4gICAgdGhpcy5pbmxpbmVTdGFjay5wdXNoKGV4cHIpO1xuICAgIHJldHVybiBleHByO1xuICB9LFxuXG4gIC8vIFtwdXNoTGl0ZXJhbF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogdmFsdWUsIC4uLlxuICAvL1xuICAvLyBQdXNoZXMgYSB2YWx1ZSBvbnRvIHRoZSBzdGFjay4gVGhpcyBvcGVyYXRpb24gcHJldmVudHNcbiAgLy8gdGhlIGNvbXBpbGVyIGZyb20gY3JlYXRpbmcgYSB0ZW1wb3JhcnkgdmFyaWFibGUgdG8gaG9sZFxuICAvLyBpdC5cbiAgcHVzaExpdGVyYWw6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKHZhbHVlKTtcbiAgfSxcblxuICAvLyBbcHVzaFByb2dyYW1dXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHByb2dyYW0oZ3VpZCksIC4uLlxuICAvL1xuICAvLyBQdXNoIGEgcHJvZ3JhbSBleHByZXNzaW9uIG9udG8gdGhlIHN0YWNrLiBUaGlzIHRha2VzXG4gIC8vIGEgY29tcGlsZS10aW1lIGd1aWQgYW5kIGNvbnZlcnRzIGl0IGludG8gYSBydW50aW1lLWFjY2Vzc2libGVcbiAgLy8gZXhwcmVzc2lvbi5cbiAgcHVzaFByb2dyYW06IGZ1bmN0aW9uKGd1aWQpIHtcbiAgICBpZiAoZ3VpZCAhPSBudWxsKSB7XG4gICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwodGhpcy5wcm9ncmFtRXhwcmVzc2lvbihndWlkKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbChudWxsKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gW2ludm9rZUhlbHBlcl1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgcGFyYW1zLi4uLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXN1bHQgb2YgaGVscGVyIGludm9jYXRpb25cbiAgLy9cbiAgLy8gUG9wcyBvZmYgdGhlIGhlbHBlcidzIHBhcmFtZXRlcnMsIGludm9rZXMgdGhlIGhlbHBlcixcbiAgLy8gYW5kIHB1c2hlcyB0aGUgaGVscGVyJ3MgcmV0dXJuIHZhbHVlIG9udG8gdGhlIHN0YWNrLlxuICAvL1xuICAvLyBJZiB0aGUgaGVscGVyIGlzIG5vdCBmb3VuZCwgYGhlbHBlck1pc3NpbmdgIGlzIGNhbGxlZC5cbiAgaW52b2tlSGVscGVyOiBmdW5jdGlvbihwYXJhbVNpemUsIG5hbWUpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5oZWxwZXJNaXNzaW5nID0gJ2hlbHBlcnMuaGVscGVyTWlzc2luZyc7XG5cbiAgICB2YXIgaGVscGVyID0gdGhpcy5sYXN0SGVscGVyID0gdGhpcy5zZXR1cEhlbHBlcihwYXJhbVNpemUsIG5hbWUsIHRydWUpO1xuICAgIHZhciBub25IZWxwZXIgPSB0aGlzLm5hbWVMb29rdXAoJ2RlcHRoJyArIHRoaXMubGFzdENvbnRleHQsIG5hbWUsICdjb250ZXh0Jyk7XG5cbiAgICB0aGlzLnB1c2goaGVscGVyLm5hbWUgKyAnIHx8ICcgKyBub25IZWxwZXIpO1xuICAgIHRoaXMucmVwbGFjZVN0YWNrKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHJldHVybiBuYW1lICsgJyA/ICcgKyBuYW1lICsgJy5jYWxsKCcgK1xuICAgICAgICAgIGhlbHBlci5jYWxsUGFyYW1zICsgXCIpIFwiICsgXCI6IGhlbHBlck1pc3NpbmcuY2FsbChcIiArXG4gICAgICAgICAgaGVscGVyLmhlbHBlck1pc3NpbmdQYXJhbXMgKyBcIilcIjtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBbaW52b2tlS25vd25IZWxwZXJdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHBhcmFtcy4uLiwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmVzdWx0IG9mIGhlbHBlciBpbnZvY2F0aW9uXG4gIC8vXG4gIC8vIFRoaXMgb3BlcmF0aW9uIGlzIHVzZWQgd2hlbiB0aGUgaGVscGVyIGlzIGtub3duIHRvIGV4aXN0LFxuICAvLyBzbyBhIGBoZWxwZXJNaXNzaW5nYCBmYWxsYmFjayBpcyBub3QgcmVxdWlyZWQuXG4gIGludm9rZUtub3duSGVscGVyOiBmdW5jdGlvbihwYXJhbVNpemUsIG5hbWUpIHtcbiAgICB2YXIgaGVscGVyID0gdGhpcy5zZXR1cEhlbHBlcihwYXJhbVNpemUsIG5hbWUpO1xuICAgIHRoaXMucHVzaChoZWxwZXIubmFtZSArIFwiLmNhbGwoXCIgKyBoZWxwZXIuY2FsbFBhcmFtcyArIFwiKVwiKTtcbiAgfSxcblxuICAvLyBbaW52b2tlQW1iaWd1b3VzXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCBwYXJhbXMuLi4sIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHJlc3VsdCBvZiBkaXNhbWJpZ3VhdGlvblxuICAvL1xuICAvLyBUaGlzIG9wZXJhdGlvbiBpcyB1c2VkIHdoZW4gYW4gZXhwcmVzc2lvbiBsaWtlIGB7e2Zvb319YFxuICAvLyBpcyBwcm92aWRlZCwgYnV0IHdlIGRvbid0IGtub3cgYXQgY29tcGlsZS10aW1lIHdoZXRoZXIgaXRcbiAgLy8gaXMgYSBoZWxwZXIgb3IgYSBwYXRoLlxuICAvL1xuICAvLyBUaGlzIG9wZXJhdGlvbiBlbWl0cyBtb3JlIGNvZGUgdGhhbiB0aGUgb3RoZXIgb3B0aW9ucyxcbiAgLy8gYW5kIGNhbiBiZSBhdm9pZGVkIGJ5IHBhc3NpbmcgdGhlIGBrbm93bkhlbHBlcnNgIGFuZFxuICAvLyBga25vd25IZWxwZXJzT25seWAgZmxhZ3MgYXQgY29tcGlsZS10aW1lLlxuICBpbnZva2VBbWJpZ3VvdXM6IGZ1bmN0aW9uKG5hbWUsIGhlbHBlckNhbGwpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5mdW5jdGlvblR5cGUgPSAnXCJmdW5jdGlvblwiJztcblxuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCgne30nKTsgICAgLy8gSGFzaCB2YWx1ZVxuICAgIHZhciBoZWxwZXIgPSB0aGlzLnNldHVwSGVscGVyKDAsIG5hbWUsIGhlbHBlckNhbGwpO1xuXG4gICAgdmFyIGhlbHBlck5hbWUgPSB0aGlzLmxhc3RIZWxwZXIgPSB0aGlzLm5hbWVMb29rdXAoJ2hlbHBlcnMnLCBuYW1lLCAnaGVscGVyJyk7XG5cbiAgICB2YXIgbm9uSGVscGVyID0gdGhpcy5uYW1lTG9va3VwKCdkZXB0aCcgKyB0aGlzLmxhc3RDb250ZXh0LCBuYW1lLCAnY29udGV4dCcpO1xuICAgIHZhciBuZXh0U3RhY2sgPSB0aGlzLm5leHRTdGFjaygpO1xuXG4gICAgdGhpcy5zb3VyY2UucHVzaCgnaWYgKCcgKyBuZXh0U3RhY2sgKyAnID0gJyArIGhlbHBlck5hbWUgKyAnKSB7ICcgKyBuZXh0U3RhY2sgKyAnID0gJyArIG5leHRTdGFjayArICcuY2FsbCgnICsgaGVscGVyLmNhbGxQYXJhbXMgKyAnKTsgfScpO1xuICAgIHRoaXMuc291cmNlLnB1c2goJ2Vsc2UgeyAnICsgbmV4dFN0YWNrICsgJyA9ICcgKyBub25IZWxwZXIgKyAnOyAnICsgbmV4dFN0YWNrICsgJyA9IHR5cGVvZiAnICsgbmV4dFN0YWNrICsgJyA9PT0gZnVuY3Rpb25UeXBlID8gJyArIG5leHRTdGFjayArICcuYXBwbHkoZGVwdGgwKSA6ICcgKyBuZXh0U3RhY2sgKyAnOyB9Jyk7XG4gIH0sXG5cbiAgLy8gW2ludm9rZVBhcnRpYWxdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGNvbnRleHQsIC4uLlxuICAvLyBPbiBzdGFjayBhZnRlcjogcmVzdWx0IG9mIHBhcnRpYWwgaW52b2NhdGlvblxuICAvL1xuICAvLyBUaGlzIG9wZXJhdGlvbiBwb3BzIG9mZiBhIGNvbnRleHQsIGludm9rZXMgYSBwYXJ0aWFsIHdpdGggdGhhdCBjb250ZXh0LFxuICAvLyBhbmQgcHVzaGVzIHRoZSByZXN1bHQgb2YgdGhlIGludm9jYXRpb24gYmFjay5cbiAgaW52b2tlUGFydGlhbDogZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBwYXJhbXMgPSBbdGhpcy5uYW1lTG9va3VwKCdwYXJ0aWFscycsIG5hbWUsICdwYXJ0aWFsJyksIFwiJ1wiICsgbmFtZSArIFwiJ1wiLCB0aGlzLnBvcFN0YWNrKCksIFwiaGVscGVyc1wiLCBcInBhcnRpYWxzXCJdO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5kYXRhKSB7XG4gICAgICBwYXJhbXMucHVzaChcImRhdGFcIik7XG4gICAgfVxuXG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuc2VsZiA9IFwidGhpc1wiO1xuICAgIHRoaXMucHVzaChcInNlbGYuaW52b2tlUGFydGlhbChcIiArIHBhcmFtcy5qb2luKFwiLCBcIikgKyBcIilcIik7XG4gIH0sXG5cbiAgLy8gW2Fzc2lnblRvSGFzaF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIGhhc2gsIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IGhhc2gsIC4uLlxuICAvL1xuICAvLyBQb3BzIGEgdmFsdWUgYW5kIGhhc2ggb2ZmIHRoZSBzdGFjaywgYXNzaWducyBgaGFzaFtrZXldID0gdmFsdWVgXG4gIC8vIGFuZCBwdXNoZXMgdGhlIGhhc2ggYmFjayBvbnRvIHRoZSBzdGFjay5cbiAgYXNzaWduVG9IYXNoOiBmdW5jdGlvbihrZXkpIHtcbiAgICB2YXIgdmFsdWUgPSB0aGlzLnBvcFN0YWNrKCksXG4gICAgICAgIGNvbnRleHQsXG4gICAgICAgIHR5cGU7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgdHlwZSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICAgIGNvbnRleHQgPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgfVxuXG4gICAgdmFyIGhhc2ggPSB0aGlzLmhhc2g7XG4gICAgaWYgKGNvbnRleHQpIHtcbiAgICAgIGhhc2guY29udGV4dHMucHVzaChcIidcIiArIGtleSArIFwiJzogXCIgKyBjb250ZXh0KTtcbiAgICB9XG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIGhhc2gudHlwZXMucHVzaChcIidcIiArIGtleSArIFwiJzogXCIgKyB0eXBlKTtcbiAgICB9XG4gICAgaGFzaC52YWx1ZXMucHVzaChcIidcIiArIGtleSArIFwiJzogKFwiICsgdmFsdWUgKyBcIilcIik7XG4gIH0sXG5cbiAgLy8gSEVMUEVSU1xuXG4gIGNvbXBpbGVyOiBKYXZhU2NyaXB0Q29tcGlsZXIsXG5cbiAgY29tcGlsZUNoaWxkcmVuOiBmdW5jdGlvbihlbnZpcm9ubWVudCwgb3B0aW9ucykge1xuICAgIHZhciBjaGlsZHJlbiA9IGVudmlyb25tZW50LmNoaWxkcmVuLCBjaGlsZCwgY29tcGlsZXI7XG5cbiAgICBmb3IodmFyIGk9MCwgbD1jaGlsZHJlbi5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBjaGlsZCA9IGNoaWxkcmVuW2ldO1xuICAgICAgY29tcGlsZXIgPSBuZXcgdGhpcy5jb21waWxlcigpO1xuXG4gICAgICB2YXIgaW5kZXggPSB0aGlzLm1hdGNoRXhpc3RpbmdQcm9ncmFtKGNoaWxkKTtcblxuICAgICAgaWYgKGluZGV4ID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LnByb2dyYW1zLnB1c2goJycpOyAgICAgLy8gUGxhY2Vob2xkZXIgdG8gcHJldmVudCBuYW1lIGNvbmZsaWN0cyBmb3IgbmVzdGVkIGNoaWxkcmVuXG4gICAgICAgIGluZGV4ID0gdGhpcy5jb250ZXh0LnByb2dyYW1zLmxlbmd0aDtcbiAgICAgICAgY2hpbGQuaW5kZXggPSBpbmRleDtcbiAgICAgICAgY2hpbGQubmFtZSA9ICdwcm9ncmFtJyArIGluZGV4O1xuICAgICAgICB0aGlzLmNvbnRleHQucHJvZ3JhbXNbaW5kZXhdID0gY29tcGlsZXIuY29tcGlsZShjaGlsZCwgb3B0aW9ucywgdGhpcy5jb250ZXh0KTtcbiAgICAgICAgdGhpcy5jb250ZXh0LmVudmlyb25tZW50c1tpbmRleF0gPSBjaGlsZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNoaWxkLmluZGV4ID0gaW5kZXg7XG4gICAgICAgIGNoaWxkLm5hbWUgPSAncHJvZ3JhbScgKyBpbmRleDtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIG1hdGNoRXhpc3RpbmdQcm9ncmFtOiBmdW5jdGlvbihjaGlsZCkge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLmNvbnRleHQuZW52aXJvbm1lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIgZW52aXJvbm1lbnQgPSB0aGlzLmNvbnRleHQuZW52aXJvbm1lbnRzW2ldO1xuICAgICAgaWYgKGVudmlyb25tZW50ICYmIGVudmlyb25tZW50LmVxdWFscyhjaGlsZCkpIHtcbiAgICAgICAgcmV0dXJuIGk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHByb2dyYW1FeHByZXNzaW9uOiBmdW5jdGlvbihndWlkKSB7XG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuc2VsZiA9IFwidGhpc1wiO1xuXG4gICAgaWYoZ3VpZCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gXCJzZWxmLm5vb3BcIjtcbiAgICB9XG5cbiAgICB2YXIgY2hpbGQgPSB0aGlzLmVudmlyb25tZW50LmNoaWxkcmVuW2d1aWRdLFxuICAgICAgICBkZXB0aHMgPSBjaGlsZC5kZXB0aHMubGlzdCwgZGVwdGg7XG5cbiAgICB2YXIgcHJvZ3JhbVBhcmFtcyA9IFtjaGlsZC5pbmRleCwgY2hpbGQubmFtZSwgXCJkYXRhXCJdO1xuXG4gICAgZm9yKHZhciBpPTAsIGwgPSBkZXB0aHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgZGVwdGggPSBkZXB0aHNbaV07XG5cbiAgICAgIGlmKGRlcHRoID09PSAxKSB7IHByb2dyYW1QYXJhbXMucHVzaChcImRlcHRoMFwiKTsgfVxuICAgICAgZWxzZSB7IHByb2dyYW1QYXJhbXMucHVzaChcImRlcHRoXCIgKyAoZGVwdGggLSAxKSk7IH1cbiAgICB9XG5cbiAgICByZXR1cm4gKGRlcHRocy5sZW5ndGggPT09IDAgPyBcInNlbGYucHJvZ3JhbShcIiA6IFwic2VsZi5wcm9ncmFtV2l0aERlcHRoKFwiKSArIHByb2dyYW1QYXJhbXMuam9pbihcIiwgXCIpICsgXCIpXCI7XG4gIH0sXG5cbiAgcmVnaXN0ZXI6IGZ1bmN0aW9uKG5hbWUsIHZhbCkge1xuICAgIHRoaXMudXNlUmVnaXN0ZXIobmFtZSk7XG4gICAgdGhpcy5zb3VyY2UucHVzaChuYW1lICsgXCIgPSBcIiArIHZhbCArIFwiO1wiKTtcbiAgfSxcblxuICB1c2VSZWdpc3RlcjogZnVuY3Rpb24obmFtZSkge1xuICAgIGlmKCF0aGlzLnJlZ2lzdGVyc1tuYW1lXSkge1xuICAgICAgdGhpcy5yZWdpc3RlcnNbbmFtZV0gPSB0cnVlO1xuICAgICAgdGhpcy5yZWdpc3RlcnMubGlzdC5wdXNoKG5hbWUpO1xuICAgIH1cbiAgfSxcblxuICBwdXNoU3RhY2tMaXRlcmFsOiBmdW5jdGlvbihpdGVtKSB7XG4gICAgcmV0dXJuIHRoaXMucHVzaChuZXcgTGl0ZXJhbChpdGVtKSk7XG4gIH0sXG5cbiAgcHVzaFN0YWNrOiBmdW5jdGlvbihpdGVtKSB7XG4gICAgdGhpcy5mbHVzaElubGluZSgpO1xuXG4gICAgdmFyIHN0YWNrID0gdGhpcy5pbmNyU3RhY2soKTtcbiAgICBpZiAoaXRlbSkge1xuICAgICAgdGhpcy5zb3VyY2UucHVzaChzdGFjayArIFwiID0gXCIgKyBpdGVtICsgXCI7XCIpO1xuICAgIH1cbiAgICB0aGlzLmNvbXBpbGVTdGFjay5wdXNoKHN0YWNrKTtcbiAgICByZXR1cm4gc3RhY2s7XG4gIH0sXG5cbiAgcmVwbGFjZVN0YWNrOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciBwcmVmaXggPSAnJyxcbiAgICAgICAgaW5saW5lID0gdGhpcy5pc0lubGluZSgpLFxuICAgICAgICBzdGFjaztcblxuICAgIC8vIElmIHdlIGFyZSBjdXJyZW50bHkgaW5saW5lIHRoZW4gd2Ugd2FudCB0byBtZXJnZSB0aGUgaW5saW5lIHN0YXRlbWVudCBpbnRvIHRoZVxuICAgIC8vIHJlcGxhY2VtZW50IHN0YXRlbWVudCB2aWEgJywnXG4gICAgaWYgKGlubGluZSkge1xuICAgICAgdmFyIHRvcCA9IHRoaXMucG9wU3RhY2sodHJ1ZSk7XG5cbiAgICAgIGlmICh0b3AgaW5zdGFuY2VvZiBMaXRlcmFsKSB7XG4gICAgICAgIC8vIExpdGVyYWxzIGRvIG5vdCBuZWVkIHRvIGJlIGlubGluZWRcbiAgICAgICAgc3RhY2sgPSB0b3AudmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBHZXQgb3IgY3JlYXRlIHRoZSBjdXJyZW50IHN0YWNrIG5hbWUgZm9yIHVzZSBieSB0aGUgaW5saW5lXG4gICAgICAgIHZhciBuYW1lID0gdGhpcy5zdGFja1Nsb3QgPyB0aGlzLnRvcFN0YWNrTmFtZSgpIDogdGhpcy5pbmNyU3RhY2soKTtcblxuICAgICAgICBwcmVmaXggPSAnKCcgKyB0aGlzLnB1c2gobmFtZSkgKyAnID0gJyArIHRvcCArICcpLCc7XG4gICAgICAgIHN0YWNrID0gdGhpcy50b3BTdGFjaygpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdGFjayA9IHRoaXMudG9wU3RhY2soKTtcbiAgICB9XG5cbiAgICB2YXIgaXRlbSA9IGNhbGxiYWNrLmNhbGwodGhpcywgc3RhY2spO1xuXG4gICAgaWYgKGlubGluZSkge1xuICAgICAgaWYgKHRoaXMuaW5saW5lU3RhY2subGVuZ3RoIHx8IHRoaXMuY29tcGlsZVN0YWNrLmxlbmd0aCkge1xuICAgICAgICB0aGlzLnBvcFN0YWNrKCk7XG4gICAgICB9XG4gICAgICB0aGlzLnB1c2goJygnICsgcHJlZml4ICsgaXRlbSArICcpJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFByZXZlbnQgbW9kaWZpY2F0aW9uIG9mIHRoZSBjb250ZXh0IGRlcHRoIHZhcmlhYmxlLiBUaHJvdWdoIHJlcGxhY2VTdGFja1xuICAgICAgaWYgKCEvXnN0YWNrLy50ZXN0KHN0YWNrKSkge1xuICAgICAgICBzdGFjayA9IHRoaXMubmV4dFN0YWNrKCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc291cmNlLnB1c2goc3RhY2sgKyBcIiA9IChcIiArIHByZWZpeCArIGl0ZW0gKyBcIik7XCIpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhY2s7XG4gIH0sXG5cbiAgbmV4dFN0YWNrOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5wdXNoU3RhY2soKTtcbiAgfSxcblxuICBpbmNyU3RhY2s6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3RhY2tTbG90Kys7XG4gICAgaWYodGhpcy5zdGFja1Nsb3QgPiB0aGlzLnN0YWNrVmFycy5sZW5ndGgpIHsgdGhpcy5zdGFja1ZhcnMucHVzaChcInN0YWNrXCIgKyB0aGlzLnN0YWNrU2xvdCk7IH1cbiAgICByZXR1cm4gdGhpcy50b3BTdGFja05hbWUoKTtcbiAgfSxcbiAgdG9wU3RhY2tOYW1lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXCJzdGFja1wiICsgdGhpcy5zdGFja1Nsb3Q7XG4gIH0sXG4gIGZsdXNoSW5saW5lOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaW5saW5lU3RhY2sgPSB0aGlzLmlubGluZVN0YWNrO1xuICAgIGlmIChpbmxpbmVTdGFjay5sZW5ndGgpIHtcbiAgICAgIHRoaXMuaW5saW5lU3RhY2sgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBpbmxpbmVTdGFjay5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB2YXIgZW50cnkgPSBpbmxpbmVTdGFja1tpXTtcbiAgICAgICAgaWYgKGVudHJ5IGluc3RhbmNlb2YgTGl0ZXJhbCkge1xuICAgICAgICAgIHRoaXMuY29tcGlsZVN0YWNrLnB1c2goZW50cnkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucHVzaFN0YWNrKGVudHJ5KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgaXNJbmxpbmU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmlubGluZVN0YWNrLmxlbmd0aDtcbiAgfSxcblxuICBwb3BTdGFjazogZnVuY3Rpb24od3JhcHBlZCkge1xuICAgIHZhciBpbmxpbmUgPSB0aGlzLmlzSW5saW5lKCksXG4gICAgICAgIGl0ZW0gPSAoaW5saW5lID8gdGhpcy5pbmxpbmVTdGFjayA6IHRoaXMuY29tcGlsZVN0YWNrKS5wb3AoKTtcblxuICAgIGlmICghd3JhcHBlZCAmJiAoaXRlbSBpbnN0YW5jZW9mIExpdGVyYWwpKSB7XG4gICAgICByZXR1cm4gaXRlbS52YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFpbmxpbmUpIHtcbiAgICAgICAgdGhpcy5zdGFja1Nsb3QtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpdGVtO1xuICAgIH1cbiAgfSxcblxuICB0b3BTdGFjazogZnVuY3Rpb24od3JhcHBlZCkge1xuICAgIHZhciBzdGFjayA9ICh0aGlzLmlzSW5saW5lKCkgPyB0aGlzLmlubGluZVN0YWNrIDogdGhpcy5jb21waWxlU3RhY2spLFxuICAgICAgICBpdGVtID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XG5cbiAgICBpZiAoIXdyYXBwZWQgJiYgKGl0ZW0gaW5zdGFuY2VvZiBMaXRlcmFsKSkge1xuICAgICAgcmV0dXJuIGl0ZW0udmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBpdGVtO1xuICAgIH1cbiAgfSxcblxuICBxdW90ZWRTdHJpbmc6IGZ1bmN0aW9uKHN0cikge1xuICAgIHJldHVybiAnXCInICsgc3RyXG4gICAgICAucmVwbGFjZSgvXFxcXC9nLCAnXFxcXFxcXFwnKVxuICAgICAgLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKVxuICAgICAgLnJlcGxhY2UoL1xcbi9nLCAnXFxcXG4nKVxuICAgICAgLnJlcGxhY2UoL1xcci9nLCAnXFxcXHInKVxuICAgICAgLnJlcGxhY2UoL1xcdTIwMjgvZywgJ1xcXFx1MjAyOCcpICAgLy8gUGVyIEVjbWEtMjYyIDcuMyArIDcuOC40XG4gICAgICAucmVwbGFjZSgvXFx1MjAyOS9nLCAnXFxcXHUyMDI5JykgKyAnXCInO1xuICB9LFxuXG4gIHNldHVwSGVscGVyOiBmdW5jdGlvbihwYXJhbVNpemUsIG5hbWUsIG1pc3NpbmdQYXJhbXMpIHtcbiAgICB2YXIgcGFyYW1zID0gW107XG4gICAgdGhpcy5zZXR1cFBhcmFtcyhwYXJhbVNpemUsIHBhcmFtcywgbWlzc2luZ1BhcmFtcyk7XG4gICAgdmFyIGZvdW5kSGVscGVyID0gdGhpcy5uYW1lTG9va3VwKCdoZWxwZXJzJywgbmFtZSwgJ2hlbHBlcicpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcmFtczogcGFyYW1zLFxuICAgICAgbmFtZTogZm91bmRIZWxwZXIsXG4gICAgICBjYWxsUGFyYW1zOiBbXCJkZXB0aDBcIl0uY29uY2F0KHBhcmFtcykuam9pbihcIiwgXCIpLFxuICAgICAgaGVscGVyTWlzc2luZ1BhcmFtczogbWlzc2luZ1BhcmFtcyAmJiBbXCJkZXB0aDBcIiwgdGhpcy5xdW90ZWRTdHJpbmcobmFtZSldLmNvbmNhdChwYXJhbXMpLmpvaW4oXCIsIFwiKVxuICAgIH07XG4gIH0sXG5cbiAgLy8gdGhlIHBhcmFtcyBhbmQgY29udGV4dHMgYXJndW1lbnRzIGFyZSBwYXNzZWQgaW4gYXJyYXlzXG4gIC8vIHRvIGZpbGwgaW5cbiAgc2V0dXBQYXJhbXM6IGZ1bmN0aW9uKHBhcmFtU2l6ZSwgcGFyYW1zLCB1c2VSZWdpc3Rlcikge1xuICAgIHZhciBvcHRpb25zID0gW10sIGNvbnRleHRzID0gW10sIHR5cGVzID0gW10sIHBhcmFtLCBpbnZlcnNlLCBwcm9ncmFtO1xuXG4gICAgb3B0aW9ucy5wdXNoKFwiaGFzaDpcIiArIHRoaXMucG9wU3RhY2soKSk7XG5cbiAgICBpbnZlcnNlID0gdGhpcy5wb3BTdGFjaygpO1xuICAgIHByb2dyYW0gPSB0aGlzLnBvcFN0YWNrKCk7XG5cbiAgICAvLyBBdm9pZCBzZXR0aW5nIGZuIGFuZCBpbnZlcnNlIGlmIG5laXRoZXIgYXJlIHNldC4gVGhpcyBhbGxvd3NcbiAgICAvLyBoZWxwZXJzIHRvIGRvIGEgY2hlY2sgZm9yIGBpZiAob3B0aW9ucy5mbilgXG4gICAgaWYgKHByb2dyYW0gfHwgaW52ZXJzZSkge1xuICAgICAgaWYgKCFwcm9ncmFtKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLnNlbGYgPSBcInRoaXNcIjtcbiAgICAgICAgcHJvZ3JhbSA9IFwic2VsZi5ub29wXCI7XG4gICAgICB9XG5cbiAgICAgIGlmICghaW52ZXJzZSkge1xuICAgICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLnNlbGYgPSBcInRoaXNcIjtcbiAgICAgICAgaW52ZXJzZSA9IFwic2VsZi5ub29wXCI7XG4gICAgICB9XG5cbiAgICAgIG9wdGlvbnMucHVzaChcImludmVyc2U6XCIgKyBpbnZlcnNlKTtcbiAgICAgIG9wdGlvbnMucHVzaChcImZuOlwiICsgcHJvZ3JhbSk7XG4gICAgfVxuXG4gICAgZm9yKHZhciBpPTA7IGk8cGFyYW1TaXplOyBpKyspIHtcbiAgICAgIHBhcmFtID0gdGhpcy5wb3BTdGFjaygpO1xuICAgICAgcGFyYW1zLnB1c2gocGFyYW0pO1xuXG4gICAgICBpZih0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICAgIHR5cGVzLnB1c2godGhpcy5wb3BTdGFjaygpKTtcbiAgICAgICAgY29udGV4dHMucHVzaCh0aGlzLnBvcFN0YWNrKCkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICBvcHRpb25zLnB1c2goXCJjb250ZXh0czpbXCIgKyBjb250ZXh0cy5qb2luKFwiLFwiKSArIFwiXVwiKTtcbiAgICAgIG9wdGlvbnMucHVzaChcInR5cGVzOltcIiArIHR5cGVzLmpvaW4oXCIsXCIpICsgXCJdXCIpO1xuICAgICAgb3B0aW9ucy5wdXNoKFwiaGFzaENvbnRleHRzOmhhc2hDb250ZXh0c1wiKTtcbiAgICAgIG9wdGlvbnMucHVzaChcImhhc2hUeXBlczpoYXNoVHlwZXNcIik7XG4gICAgfVxuXG4gICAgaWYodGhpcy5vcHRpb25zLmRhdGEpIHtcbiAgICAgIG9wdGlvbnMucHVzaChcImRhdGE6ZGF0YVwiKTtcbiAgICB9XG5cbiAgICBvcHRpb25zID0gXCJ7XCIgKyBvcHRpb25zLmpvaW4oXCIsXCIpICsgXCJ9XCI7XG4gICAgaWYgKHVzZVJlZ2lzdGVyKSB7XG4gICAgICB0aGlzLnJlZ2lzdGVyKCdvcHRpb25zJywgb3B0aW9ucyk7XG4gICAgICBwYXJhbXMucHVzaCgnb3B0aW9ucycpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXMucHVzaChvcHRpb25zKTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcmFtcy5qb2luKFwiLCBcIik7XG4gIH1cbn07XG5cbnZhciByZXNlcnZlZFdvcmRzID0gKFxuICBcImJyZWFrIGVsc2UgbmV3IHZhclwiICtcbiAgXCIgY2FzZSBmaW5hbGx5IHJldHVybiB2b2lkXCIgK1xuICBcIiBjYXRjaCBmb3Igc3dpdGNoIHdoaWxlXCIgK1xuICBcIiBjb250aW51ZSBmdW5jdGlvbiB0aGlzIHdpdGhcIiArXG4gIFwiIGRlZmF1bHQgaWYgdGhyb3dcIiArXG4gIFwiIGRlbGV0ZSBpbiB0cnlcIiArXG4gIFwiIGRvIGluc3RhbmNlb2YgdHlwZW9mXCIgK1xuICBcIiBhYnN0cmFjdCBlbnVtIGludCBzaG9ydFwiICtcbiAgXCIgYm9vbGVhbiBleHBvcnQgaW50ZXJmYWNlIHN0YXRpY1wiICtcbiAgXCIgYnl0ZSBleHRlbmRzIGxvbmcgc3VwZXJcIiArXG4gIFwiIGNoYXIgZmluYWwgbmF0aXZlIHN5bmNocm9uaXplZFwiICtcbiAgXCIgY2xhc3MgZmxvYXQgcGFja2FnZSB0aHJvd3NcIiArXG4gIFwiIGNvbnN0IGdvdG8gcHJpdmF0ZSB0cmFuc2llbnRcIiArXG4gIFwiIGRlYnVnZ2VyIGltcGxlbWVudHMgcHJvdGVjdGVkIHZvbGF0aWxlXCIgK1xuICBcIiBkb3VibGUgaW1wb3J0IHB1YmxpYyBsZXQgeWllbGRcIlxuKS5zcGxpdChcIiBcIik7XG5cbnZhciBjb21waWxlcldvcmRzID0gSmF2YVNjcmlwdENvbXBpbGVyLlJFU0VSVkVEX1dPUkRTID0ge307XG5cbmZvcih2YXIgaT0wLCBsPXJlc2VydmVkV29yZHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICBjb21waWxlcldvcmRzW3Jlc2VydmVkV29yZHNbaV1dID0gdHJ1ZTtcbn1cblxuSmF2YVNjcmlwdENvbXBpbGVyLmlzVmFsaWRKYXZhU2NyaXB0VmFyaWFibGVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICBpZighSmF2YVNjcmlwdENvbXBpbGVyLlJFU0VSVkVEX1dPUkRTW25hbWVdICYmIC9eW2EtekEtWl8kXVswLTlhLXpBLVpfJF0rJC8udGVzdChuYW1lKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbkhhbmRsZWJhcnMucHJlY29tcGlsZSA9IGZ1bmN0aW9uKGlucHV0LCBvcHRpb25zKSB7XG4gIGlmIChpbnB1dCA9PSBudWxsIHx8ICh0eXBlb2YgaW5wdXQgIT09ICdzdHJpbmcnICYmIGlucHV0LmNvbnN0cnVjdG9yICE9PSBIYW5kbGViYXJzLkFTVC5Qcm9ncmFtTm9kZSkpIHtcbiAgICB0aHJvdyBuZXcgSGFuZGxlYmFycy5FeGNlcHRpb24oXCJZb3UgbXVzdCBwYXNzIGEgc3RyaW5nIG9yIEhhbmRsZWJhcnMgQVNUIHRvIEhhbmRsZWJhcnMucHJlY29tcGlsZS4gWW91IHBhc3NlZCBcIiArIGlucHV0KTtcbiAgfVxuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoISgnZGF0YScgaW4gb3B0aW9ucykpIHtcbiAgICBvcHRpb25zLmRhdGEgPSB0cnVlO1xuICB9XG4gIHZhciBhc3QgPSBIYW5kbGViYXJzLnBhcnNlKGlucHV0KTtcbiAgdmFyIGVudmlyb25tZW50ID0gbmV3IENvbXBpbGVyKCkuY29tcGlsZShhc3QsIG9wdGlvbnMpO1xuICByZXR1cm4gbmV3IEphdmFTY3JpcHRDb21waWxlcigpLmNvbXBpbGUoZW52aXJvbm1lbnQsIG9wdGlvbnMpO1xufTtcblxuSGFuZGxlYmFycy5jb21waWxlID0gZnVuY3Rpb24oaW5wdXQsIG9wdGlvbnMpIHtcbiAgaWYgKGlucHV0ID09IG51bGwgfHwgKHR5cGVvZiBpbnB1dCAhPT0gJ3N0cmluZycgJiYgaW5wdXQuY29uc3RydWN0b3IgIT09IEhhbmRsZWJhcnMuQVNULlByb2dyYW1Ob2RlKSkge1xuICAgIHRocm93IG5ldyBIYW5kbGViYXJzLkV4Y2VwdGlvbihcIllvdSBtdXN0IHBhc3MgYSBzdHJpbmcgb3IgSGFuZGxlYmFycyBBU1QgdG8gSGFuZGxlYmFycy5jb21waWxlLiBZb3UgcGFzc2VkIFwiICsgaW5wdXQpO1xuICB9XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIGlmICghKCdkYXRhJyBpbiBvcHRpb25zKSkge1xuICAgIG9wdGlvbnMuZGF0YSA9IHRydWU7XG4gIH1cbiAgdmFyIGNvbXBpbGVkO1xuICBmdW5jdGlvbiBjb21waWxlKCkge1xuICAgIHZhciBhc3QgPSBIYW5kbGViYXJzLnBhcnNlKGlucHV0KTtcbiAgICB2YXIgZW52aXJvbm1lbnQgPSBuZXcgQ29tcGlsZXIoKS5jb21waWxlKGFzdCwgb3B0aW9ucyk7XG4gICAgdmFyIHRlbXBsYXRlU3BlYyA9IG5ldyBKYXZhU2NyaXB0Q29tcGlsZXIoKS5jb21waWxlKGVudmlyb25tZW50LCBvcHRpb25zLCB1bmRlZmluZWQsIHRydWUpO1xuICAgIHJldHVybiBIYW5kbGViYXJzLnRlbXBsYXRlKHRlbXBsYXRlU3BlYyk7XG4gIH1cblxuICAvLyBUZW1wbGF0ZSBpcyBvbmx5IGNvbXBpbGVkIG9uIGZpcnN0IHVzZSBhbmQgY2FjaGVkIGFmdGVyIHRoYXQgcG9pbnQuXG4gIHJldHVybiBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgaWYgKCFjb21waWxlZCkge1xuICAgICAgY29tcGlsZWQgPSBjb21waWxlKCk7XG4gICAgfVxuICAgIHJldHVybiBjb21waWxlZC5jYWxsKHRoaXMsIGNvbnRleHQsIG9wdGlvbnMpO1xuICB9O1xufTtcblxuXG4vLyBFTkQoQlJPV1NFUilcblxucmV0dXJuIEhhbmRsZWJhcnM7XG5cbn07XG5cblxuIiwiLy8gRWFjaCBvZiB0aGVzZSBtb2R1bGUgd2lsbCBhdWdtZW50IHRoZSBIYW5kbGViYXJzIG9iamVjdCBhcyBpdCBsb2Fkcy4gTm8gbmVlZCB0byBwZXJmb3JtIGFkZGl0aW9uIG9wZXJhdGlvbnNcbm1vZHVsZS5leHBvcnRzLmF0dGFjaCA9IGZ1bmN0aW9uKEhhbmRsZWJhcnMpIHtcblxudmFyIHZpc2l0b3IgPSByZXF1aXJlKFwiLi92aXNpdG9yXCIpLFxuICAgIHByaW50ZXIgPSByZXF1aXJlKFwiLi9wcmludGVyXCIpLFxuICAgIGFzdCA9IHJlcXVpcmUoXCIuL2FzdFwiKSxcbiAgICBjb21waWxlciA9IHJlcXVpcmUoXCIuL2NvbXBpbGVyXCIpO1xuXG52aXNpdG9yLmF0dGFjaChIYW5kbGViYXJzKTtcbnByaW50ZXIuYXR0YWNoKEhhbmRsZWJhcnMpO1xuYXN0LmF0dGFjaChIYW5kbGViYXJzKTtcbmNvbXBpbGVyLmF0dGFjaChIYW5kbGViYXJzKTtcblxucmV0dXJuIEhhbmRsZWJhcnM7XG5cbn07XG4iLCIvLyBCRUdJTihCUk9XU0VSKVxuLyogSmlzb24gZ2VuZXJhdGVkIHBhcnNlciAqL1xudmFyIGhhbmRsZWJhcnMgPSAoZnVuY3Rpb24oKXtcbnZhciBwYXJzZXIgPSB7dHJhY2U6IGZ1bmN0aW9uIHRyYWNlKCkgeyB9LFxueXk6IHt9LFxuc3ltYm9sc186IHtcImVycm9yXCI6MixcInJvb3RcIjozLFwicHJvZ3JhbVwiOjQsXCJFT0ZcIjo1LFwic2ltcGxlSW52ZXJzZVwiOjYsXCJzdGF0ZW1lbnRzXCI6NyxcInN0YXRlbWVudFwiOjgsXCJvcGVuSW52ZXJzZVwiOjksXCJjbG9zZUJsb2NrXCI6MTAsXCJvcGVuQmxvY2tcIjoxMSxcIm11c3RhY2hlXCI6MTIsXCJwYXJ0aWFsXCI6MTMsXCJDT05URU5UXCI6MTQsXCJDT01NRU5UXCI6MTUsXCJPUEVOX0JMT0NLXCI6MTYsXCJpbk11c3RhY2hlXCI6MTcsXCJDTE9TRVwiOjE4LFwiT1BFTl9JTlZFUlNFXCI6MTksXCJPUEVOX0VOREJMT0NLXCI6MjAsXCJwYXRoXCI6MjEsXCJPUEVOXCI6MjIsXCJPUEVOX1VORVNDQVBFRFwiOjIzLFwiQ0xPU0VfVU5FU0NBUEVEXCI6MjQsXCJPUEVOX1BBUlRJQUxcIjoyNSxcInBhcnRpYWxOYW1lXCI6MjYsXCJwYXJhbXNcIjoyNyxcImhhc2hcIjoyOCxcImRhdGFOYW1lXCI6MjksXCJwYXJhbVwiOjMwLFwiU1RSSU5HXCI6MzEsXCJJTlRFR0VSXCI6MzIsXCJCT09MRUFOXCI6MzMsXCJoYXNoU2VnbWVudHNcIjozNCxcImhhc2hTZWdtZW50XCI6MzUsXCJJRFwiOjM2LFwiRVFVQUxTXCI6MzcsXCJEQVRBXCI6MzgsXCJwYXRoU2VnbWVudHNcIjozOSxcIlNFUFwiOjQwLFwiJGFjY2VwdFwiOjAsXCIkZW5kXCI6MX0sXG50ZXJtaW5hbHNfOiB7MjpcImVycm9yXCIsNTpcIkVPRlwiLDE0OlwiQ09OVEVOVFwiLDE1OlwiQ09NTUVOVFwiLDE2OlwiT1BFTl9CTE9DS1wiLDE4OlwiQ0xPU0VcIiwxOTpcIk9QRU5fSU5WRVJTRVwiLDIwOlwiT1BFTl9FTkRCTE9DS1wiLDIyOlwiT1BFTlwiLDIzOlwiT1BFTl9VTkVTQ0FQRURcIiwyNDpcIkNMT1NFX1VORVNDQVBFRFwiLDI1OlwiT1BFTl9QQVJUSUFMXCIsMzE6XCJTVFJJTkdcIiwzMjpcIklOVEVHRVJcIiwzMzpcIkJPT0xFQU5cIiwzNjpcIklEXCIsMzc6XCJFUVVBTFNcIiwzODpcIkRBVEFcIiw0MDpcIlNFUFwifSxcbnByb2R1Y3Rpb25zXzogWzAsWzMsMl0sWzQsMl0sWzQsM10sWzQsMl0sWzQsMV0sWzQsMV0sWzQsMF0sWzcsMV0sWzcsMl0sWzgsM10sWzgsM10sWzgsMV0sWzgsMV0sWzgsMV0sWzgsMV0sWzExLDNdLFs5LDNdLFsxMCwzXSxbMTIsM10sWzEyLDNdLFsxMywzXSxbMTMsNF0sWzYsMl0sWzE3LDNdLFsxNywyXSxbMTcsMl0sWzE3LDFdLFsxNywxXSxbMjcsMl0sWzI3LDFdLFszMCwxXSxbMzAsMV0sWzMwLDFdLFszMCwxXSxbMzAsMV0sWzI4LDFdLFszNCwyXSxbMzQsMV0sWzM1LDNdLFszNSwzXSxbMzUsM10sWzM1LDNdLFszNSwzXSxbMjYsMV0sWzI2LDFdLFsyNiwxXSxbMjksMl0sWzIxLDFdLFszOSwzXSxbMzksMV1dLFxucGVyZm9ybUFjdGlvbjogZnVuY3Rpb24gYW5vbnltb3VzKHl5dGV4dCx5eWxlbmcseXlsaW5lbm8seXkseXlzdGF0ZSwkJCxfJCkge1xuXG52YXIgJDAgPSAkJC5sZW5ndGggLSAxO1xuc3dpdGNoICh5eXN0YXRlKSB7XG5jYXNlIDE6IHJldHVybiAkJFskMC0xXTsgXG5icmVhaztcbmNhc2UgMjogdGhpcy4kID0gbmV3IHl5LlByb2dyYW1Ob2RlKFtdLCAkJFskMF0pOyBcbmJyZWFrO1xuY2FzZSAzOiB0aGlzLiQgPSBuZXcgeXkuUHJvZ3JhbU5vZGUoJCRbJDAtMl0sICQkWyQwXSk7IFxuYnJlYWs7XG5jYXNlIDQ6IHRoaXMuJCA9IG5ldyB5eS5Qcm9ncmFtTm9kZSgkJFskMC0xXSwgW10pOyBcbmJyZWFrO1xuY2FzZSA1OiB0aGlzLiQgPSBuZXcgeXkuUHJvZ3JhbU5vZGUoJCRbJDBdKTsgXG5icmVhaztcbmNhc2UgNjogdGhpcy4kID0gbmV3IHl5LlByb2dyYW1Ob2RlKFtdLCBbXSk7IFxuYnJlYWs7XG5jYXNlIDc6IHRoaXMuJCA9IG5ldyB5eS5Qcm9ncmFtTm9kZShbXSk7IFxuYnJlYWs7XG5jYXNlIDg6IHRoaXMuJCA9IFskJFskMF1dOyBcbmJyZWFrO1xuY2FzZSA5OiAkJFskMC0xXS5wdXNoKCQkWyQwXSk7IHRoaXMuJCA9ICQkWyQwLTFdOyBcbmJyZWFrO1xuY2FzZSAxMDogdGhpcy4kID0gbmV3IHl5LkJsb2NrTm9kZSgkJFskMC0yXSwgJCRbJDAtMV0uaW52ZXJzZSwgJCRbJDAtMV0sICQkWyQwXSk7IFxuYnJlYWs7XG5jYXNlIDExOiB0aGlzLiQgPSBuZXcgeXkuQmxvY2tOb2RlKCQkWyQwLTJdLCAkJFskMC0xXSwgJCRbJDAtMV0uaW52ZXJzZSwgJCRbJDBdKTsgXG5icmVhaztcbmNhc2UgMTI6IHRoaXMuJCA9ICQkWyQwXTsgXG5icmVhaztcbmNhc2UgMTM6IHRoaXMuJCA9ICQkWyQwXTsgXG5icmVhaztcbmNhc2UgMTQ6IHRoaXMuJCA9IG5ldyB5eS5Db250ZW50Tm9kZSgkJFskMF0pOyBcbmJyZWFrO1xuY2FzZSAxNTogdGhpcy4kID0gbmV3IHl5LkNvbW1lbnROb2RlKCQkWyQwXSk7IFxuYnJlYWs7XG5jYXNlIDE2OiB0aGlzLiQgPSBuZXcgeXkuTXVzdGFjaGVOb2RlKCQkWyQwLTFdWzBdLCAkJFskMC0xXVsxXSk7IFxuYnJlYWs7XG5jYXNlIDE3OiB0aGlzLiQgPSBuZXcgeXkuTXVzdGFjaGVOb2RlKCQkWyQwLTFdWzBdLCAkJFskMC0xXVsxXSk7IFxuYnJlYWs7XG5jYXNlIDE4OiB0aGlzLiQgPSAkJFskMC0xXTsgXG5icmVhaztcbmNhc2UgMTk6XG4gICAgLy8gUGFyc2luZyBvdXQgdGhlICcmJyBlc2NhcGUgdG9rZW4gYXQgdGhpcyBsZXZlbCBzYXZlcyB+NTAwIGJ5dGVzIGFmdGVyIG1pbiBkdWUgdG8gdGhlIHJlbW92YWwgb2Ygb25lIHBhcnNlciBub2RlLlxuICAgIHRoaXMuJCA9IG5ldyB5eS5NdXN0YWNoZU5vZGUoJCRbJDAtMV1bMF0sICQkWyQwLTFdWzFdLCAkJFskMC0yXVsyXSA9PT0gJyYnKTtcbiAgXG5icmVhaztcbmNhc2UgMjA6IHRoaXMuJCA9IG5ldyB5eS5NdXN0YWNoZU5vZGUoJCRbJDAtMV1bMF0sICQkWyQwLTFdWzFdLCB0cnVlKTsgXG5icmVhaztcbmNhc2UgMjE6IHRoaXMuJCA9IG5ldyB5eS5QYXJ0aWFsTm9kZSgkJFskMC0xXSk7IFxuYnJlYWs7XG5jYXNlIDIyOiB0aGlzLiQgPSBuZXcgeXkuUGFydGlhbE5vZGUoJCRbJDAtMl0sICQkWyQwLTFdKTsgXG5icmVhaztcbmNhc2UgMjM6IFxuYnJlYWs7XG5jYXNlIDI0OiB0aGlzLiQgPSBbWyQkWyQwLTJdXS5jb25jYXQoJCRbJDAtMV0pLCAkJFskMF1dOyBcbmJyZWFrO1xuY2FzZSAyNTogdGhpcy4kID0gW1skJFskMC0xXV0uY29uY2F0KCQkWyQwXSksIG51bGxdOyBcbmJyZWFrO1xuY2FzZSAyNjogdGhpcy4kID0gW1skJFskMC0xXV0sICQkWyQwXV07IFxuYnJlYWs7XG5jYXNlIDI3OiB0aGlzLiQgPSBbWyQkWyQwXV0sIG51bGxdOyBcbmJyZWFrO1xuY2FzZSAyODogdGhpcy4kID0gW1skJFskMF1dLCBudWxsXTsgXG5icmVhaztcbmNhc2UgMjk6ICQkWyQwLTFdLnB1c2goJCRbJDBdKTsgdGhpcy4kID0gJCRbJDAtMV07IFxuYnJlYWs7XG5jYXNlIDMwOiB0aGlzLiQgPSBbJCRbJDBdXTsgXG5icmVhaztcbmNhc2UgMzE6IHRoaXMuJCA9ICQkWyQwXTsgXG5icmVhaztcbmNhc2UgMzI6IHRoaXMuJCA9IG5ldyB5eS5TdHJpbmdOb2RlKCQkWyQwXSk7IFxuYnJlYWs7XG5jYXNlIDMzOiB0aGlzLiQgPSBuZXcgeXkuSW50ZWdlck5vZGUoJCRbJDBdKTsgXG5icmVhaztcbmNhc2UgMzQ6IHRoaXMuJCA9IG5ldyB5eS5Cb29sZWFuTm9kZSgkJFskMF0pOyBcbmJyZWFrO1xuY2FzZSAzNTogdGhpcy4kID0gJCRbJDBdOyBcbmJyZWFrO1xuY2FzZSAzNjogdGhpcy4kID0gbmV3IHl5Lkhhc2hOb2RlKCQkWyQwXSk7IFxuYnJlYWs7XG5jYXNlIDM3OiAkJFskMC0xXS5wdXNoKCQkWyQwXSk7IHRoaXMuJCA9ICQkWyQwLTFdOyBcbmJyZWFrO1xuY2FzZSAzODogdGhpcy4kID0gWyQkWyQwXV07IFxuYnJlYWs7XG5jYXNlIDM5OiB0aGlzLiQgPSBbJCRbJDAtMl0sICQkWyQwXV07IFxuYnJlYWs7XG5jYXNlIDQwOiB0aGlzLiQgPSBbJCRbJDAtMl0sIG5ldyB5eS5TdHJpbmdOb2RlKCQkWyQwXSldOyBcbmJyZWFrO1xuY2FzZSA0MTogdGhpcy4kID0gWyQkWyQwLTJdLCBuZXcgeXkuSW50ZWdlck5vZGUoJCRbJDBdKV07IFxuYnJlYWs7XG5jYXNlIDQyOiB0aGlzLiQgPSBbJCRbJDAtMl0sIG5ldyB5eS5Cb29sZWFuTm9kZSgkJFskMF0pXTsgXG5icmVhaztcbmNhc2UgNDM6IHRoaXMuJCA9IFskJFskMC0yXSwgJCRbJDBdXTsgXG5icmVhaztcbmNhc2UgNDQ6IHRoaXMuJCA9IG5ldyB5eS5QYXJ0aWFsTmFtZU5vZGUoJCRbJDBdKTsgXG5icmVhaztcbmNhc2UgNDU6IHRoaXMuJCA9IG5ldyB5eS5QYXJ0aWFsTmFtZU5vZGUobmV3IHl5LlN0cmluZ05vZGUoJCRbJDBdKSk7IFxuYnJlYWs7XG5jYXNlIDQ2OiB0aGlzLiQgPSBuZXcgeXkuUGFydGlhbE5hbWVOb2RlKG5ldyB5eS5JbnRlZ2VyTm9kZSgkJFskMF0pKTsgXG5icmVhaztcbmNhc2UgNDc6IHRoaXMuJCA9IG5ldyB5eS5EYXRhTm9kZSgkJFskMF0pOyBcbmJyZWFrO1xuY2FzZSA0ODogdGhpcy4kID0gbmV3IHl5LklkTm9kZSgkJFskMF0pOyBcbmJyZWFrO1xuY2FzZSA0OTogJCRbJDAtMl0ucHVzaCh7cGFydDogJCRbJDBdLCBzZXBhcmF0b3I6ICQkWyQwLTFdfSk7IHRoaXMuJCA9ICQkWyQwLTJdOyBcbmJyZWFrO1xuY2FzZSA1MDogdGhpcy4kID0gW3twYXJ0OiAkJFskMF19XTsgXG5icmVhaztcbn1cbn0sXG50YWJsZTogW3szOjEsNDoyLDU6WzIsN10sNjozLDc6NCw4OjYsOTo3LDExOjgsMTI6OSwxMzoxMCwxNDpbMSwxMV0sMTU6WzEsMTJdLDE2OlsxLDEzXSwxOTpbMSw1XSwyMjpbMSwxNF0sMjM6WzEsMTVdLDI1OlsxLDE2XX0sezE6WzNdfSx7NTpbMSwxN119LHs1OlsyLDZdLDc6MTgsODo2LDk6NywxMTo4LDEyOjksMTM6MTAsMTQ6WzEsMTFdLDE1OlsxLDEyXSwxNjpbMSwxM10sMTk6WzEsMTldLDIwOlsyLDZdLDIyOlsxLDE0XSwyMzpbMSwxNV0sMjU6WzEsMTZdfSx7NTpbMiw1XSw2OjIwLDg6MjEsOTo3LDExOjgsMTI6OSwxMzoxMCwxNDpbMSwxMV0sMTU6WzEsMTJdLDE2OlsxLDEzXSwxOTpbMSw1XSwyMDpbMiw1XSwyMjpbMSwxNF0sMjM6WzEsMTVdLDI1OlsxLDE2XX0sezE3OjIzLDE4OlsxLDIyXSwyMToyNCwyOToyNSwzNjpbMSwyOF0sMzg6WzEsMjddLDM5OjI2fSx7NTpbMiw4XSwxNDpbMiw4XSwxNTpbMiw4XSwxNjpbMiw4XSwxOTpbMiw4XSwyMDpbMiw4XSwyMjpbMiw4XSwyMzpbMiw4XSwyNTpbMiw4XX0sezQ6MjksNjozLDc6NCw4OjYsOTo3LDExOjgsMTI6OSwxMzoxMCwxNDpbMSwxMV0sMTU6WzEsMTJdLDE2OlsxLDEzXSwxOTpbMSw1XSwyMDpbMiw3XSwyMjpbMSwxNF0sMjM6WzEsMTVdLDI1OlsxLDE2XX0sezQ6MzAsNjozLDc6NCw4OjYsOTo3LDExOjgsMTI6OSwxMzoxMCwxNDpbMSwxMV0sMTU6WzEsMTJdLDE2OlsxLDEzXSwxOTpbMSw1XSwyMDpbMiw3XSwyMjpbMSwxNF0sMjM6WzEsMTVdLDI1OlsxLDE2XX0sezU6WzIsMTJdLDE0OlsyLDEyXSwxNTpbMiwxMl0sMTY6WzIsMTJdLDE5OlsyLDEyXSwyMDpbMiwxMl0sMjI6WzIsMTJdLDIzOlsyLDEyXSwyNTpbMiwxMl19LHs1OlsyLDEzXSwxNDpbMiwxM10sMTU6WzIsMTNdLDE2OlsyLDEzXSwxOTpbMiwxM10sMjA6WzIsMTNdLDIyOlsyLDEzXSwyMzpbMiwxM10sMjU6WzIsMTNdfSx7NTpbMiwxNF0sMTQ6WzIsMTRdLDE1OlsyLDE0XSwxNjpbMiwxNF0sMTk6WzIsMTRdLDIwOlsyLDE0XSwyMjpbMiwxNF0sMjM6WzIsMTRdLDI1OlsyLDE0XX0sezU6WzIsMTVdLDE0OlsyLDE1XSwxNTpbMiwxNV0sMTY6WzIsMTVdLDE5OlsyLDE1XSwyMDpbMiwxNV0sMjI6WzIsMTVdLDIzOlsyLDE1XSwyNTpbMiwxNV19LHsxNzozMSwyMToyNCwyOToyNSwzNjpbMSwyOF0sMzg6WzEsMjddLDM5OjI2fSx7MTc6MzIsMjE6MjQsMjk6MjUsMzY6WzEsMjhdLDM4OlsxLDI3XSwzOToyNn0sezE3OjMzLDIxOjI0LDI5OjI1LDM2OlsxLDI4XSwzODpbMSwyN10sMzk6MjZ9LHsyMTozNSwyNjozNCwzMTpbMSwzNl0sMzI6WzEsMzddLDM2OlsxLDI4XSwzOToyNn0sezE6WzIsMV19LHs1OlsyLDJdLDg6MjEsOTo3LDExOjgsMTI6OSwxMzoxMCwxNDpbMSwxMV0sMTU6WzEsMTJdLDE2OlsxLDEzXSwxOTpbMSwxOV0sMjA6WzIsMl0sMjI6WzEsMTRdLDIzOlsxLDE1XSwyNTpbMSwxNl19LHsxNzoyMywyMToyNCwyOToyNSwzNjpbMSwyOF0sMzg6WzEsMjddLDM5OjI2fSx7NTpbMiw0XSw3OjM4LDg6Niw5OjcsMTE6OCwxMjo5LDEzOjEwLDE0OlsxLDExXSwxNTpbMSwxMl0sMTY6WzEsMTNdLDE5OlsxLDE5XSwyMDpbMiw0XSwyMjpbMSwxNF0sMjM6WzEsMTVdLDI1OlsxLDE2XX0sezU6WzIsOV0sMTQ6WzIsOV0sMTU6WzIsOV0sMTY6WzIsOV0sMTk6WzIsOV0sMjA6WzIsOV0sMjI6WzIsOV0sMjM6WzIsOV0sMjU6WzIsOV19LHs1OlsyLDIzXSwxNDpbMiwyM10sMTU6WzIsMjNdLDE2OlsyLDIzXSwxOTpbMiwyM10sMjA6WzIsMjNdLDIyOlsyLDIzXSwyMzpbMiwyM10sMjU6WzIsMjNdfSx7MTg6WzEsMzldfSx7MTg6WzIsMjddLDIxOjQ0LDI0OlsyLDI3XSwyNzo0MCwyODo0MSwyOTo0OCwzMDo0MiwzMTpbMSw0NV0sMzI6WzEsNDZdLDMzOlsxLDQ3XSwzNDo0MywzNTo0OSwzNjpbMSw1MF0sMzg6WzEsMjddLDM5OjI2fSx7MTg6WzIsMjhdLDI0OlsyLDI4XX0sezE4OlsyLDQ4XSwyNDpbMiw0OF0sMzE6WzIsNDhdLDMyOlsyLDQ4XSwzMzpbMiw0OF0sMzY6WzIsNDhdLDM4OlsyLDQ4XSw0MDpbMSw1MV19LHsyMTo1MiwzNjpbMSwyOF0sMzk6MjZ9LHsxODpbMiw1MF0sMjQ6WzIsNTBdLDMxOlsyLDUwXSwzMjpbMiw1MF0sMzM6WzIsNTBdLDM2OlsyLDUwXSwzODpbMiw1MF0sNDA6WzIsNTBdfSx7MTA6NTMsMjA6WzEsNTRdfSx7MTA6NTUsMjA6WzEsNTRdfSx7MTg6WzEsNTZdfSx7MTg6WzEsNTddfSx7MjQ6WzEsNThdfSx7MTg6WzEsNTldLDIxOjYwLDM2OlsxLDI4XSwzOToyNn0sezE4OlsyLDQ0XSwzNjpbMiw0NF19LHsxODpbMiw0NV0sMzY6WzIsNDVdfSx7MTg6WzIsNDZdLDM2OlsyLDQ2XX0sezU6WzIsM10sODoyMSw5OjcsMTE6OCwxMjo5LDEzOjEwLDE0OlsxLDExXSwxNTpbMSwxMl0sMTY6WzEsMTNdLDE5OlsxLDE5XSwyMDpbMiwzXSwyMjpbMSwxNF0sMjM6WzEsMTVdLDI1OlsxLDE2XX0sezE0OlsyLDE3XSwxNTpbMiwxN10sMTY6WzIsMTddLDE5OlsyLDE3XSwyMDpbMiwxN10sMjI6WzIsMTddLDIzOlsyLDE3XSwyNTpbMiwxN119LHsxODpbMiwyNV0sMjE6NDQsMjQ6WzIsMjVdLDI4OjYxLDI5OjQ4LDMwOjYyLDMxOlsxLDQ1XSwzMjpbMSw0Nl0sMzM6WzEsNDddLDM0OjQzLDM1OjQ5LDM2OlsxLDUwXSwzODpbMSwyN10sMzk6MjZ9LHsxODpbMiwyNl0sMjQ6WzIsMjZdfSx7MTg6WzIsMzBdLDI0OlsyLDMwXSwzMTpbMiwzMF0sMzI6WzIsMzBdLDMzOlsyLDMwXSwzNjpbMiwzMF0sMzg6WzIsMzBdfSx7MTg6WzIsMzZdLDI0OlsyLDM2XSwzNTo2MywzNjpbMSw2NF19LHsxODpbMiwzMV0sMjQ6WzIsMzFdLDMxOlsyLDMxXSwzMjpbMiwzMV0sMzM6WzIsMzFdLDM2OlsyLDMxXSwzODpbMiwzMV19LHsxODpbMiwzMl0sMjQ6WzIsMzJdLDMxOlsyLDMyXSwzMjpbMiwzMl0sMzM6WzIsMzJdLDM2OlsyLDMyXSwzODpbMiwzMl19LHsxODpbMiwzM10sMjQ6WzIsMzNdLDMxOlsyLDMzXSwzMjpbMiwzM10sMzM6WzIsMzNdLDM2OlsyLDMzXSwzODpbMiwzM119LHsxODpbMiwzNF0sMjQ6WzIsMzRdLDMxOlsyLDM0XSwzMjpbMiwzNF0sMzM6WzIsMzRdLDM2OlsyLDM0XSwzODpbMiwzNF19LHsxODpbMiwzNV0sMjQ6WzIsMzVdLDMxOlsyLDM1XSwzMjpbMiwzNV0sMzM6WzIsMzVdLDM2OlsyLDM1XSwzODpbMiwzNV19LHsxODpbMiwzOF0sMjQ6WzIsMzhdLDM2OlsyLDM4XX0sezE4OlsyLDUwXSwyNDpbMiw1MF0sMzE6WzIsNTBdLDMyOlsyLDUwXSwzMzpbMiw1MF0sMzY6WzIsNTBdLDM3OlsxLDY1XSwzODpbMiw1MF0sNDA6WzIsNTBdfSx7MzY6WzEsNjZdfSx7MTg6WzIsNDddLDI0OlsyLDQ3XSwzMTpbMiw0N10sMzI6WzIsNDddLDMzOlsyLDQ3XSwzNjpbMiw0N10sMzg6WzIsNDddfSx7NTpbMiwxMF0sMTQ6WzIsMTBdLDE1OlsyLDEwXSwxNjpbMiwxMF0sMTk6WzIsMTBdLDIwOlsyLDEwXSwyMjpbMiwxMF0sMjM6WzIsMTBdLDI1OlsyLDEwXX0sezIxOjY3LDM2OlsxLDI4XSwzOToyNn0sezU6WzIsMTFdLDE0OlsyLDExXSwxNTpbMiwxMV0sMTY6WzIsMTFdLDE5OlsyLDExXSwyMDpbMiwxMV0sMjI6WzIsMTFdLDIzOlsyLDExXSwyNTpbMiwxMV19LHsxNDpbMiwxNl0sMTU6WzIsMTZdLDE2OlsyLDE2XSwxOTpbMiwxNl0sMjA6WzIsMTZdLDIyOlsyLDE2XSwyMzpbMiwxNl0sMjU6WzIsMTZdfSx7NTpbMiwxOV0sMTQ6WzIsMTldLDE1OlsyLDE5XSwxNjpbMiwxOV0sMTk6WzIsMTldLDIwOlsyLDE5XSwyMjpbMiwxOV0sMjM6WzIsMTldLDI1OlsyLDE5XX0sezU6WzIsMjBdLDE0OlsyLDIwXSwxNTpbMiwyMF0sMTY6WzIsMjBdLDE5OlsyLDIwXSwyMDpbMiwyMF0sMjI6WzIsMjBdLDIzOlsyLDIwXSwyNTpbMiwyMF19LHs1OlsyLDIxXSwxNDpbMiwyMV0sMTU6WzIsMjFdLDE2OlsyLDIxXSwxOTpbMiwyMV0sMjA6WzIsMjFdLDIyOlsyLDIxXSwyMzpbMiwyMV0sMjU6WzIsMjFdfSx7MTg6WzEsNjhdfSx7MTg6WzIsMjRdLDI0OlsyLDI0XX0sezE4OlsyLDI5XSwyNDpbMiwyOV0sMzE6WzIsMjldLDMyOlsyLDI5XSwzMzpbMiwyOV0sMzY6WzIsMjldLDM4OlsyLDI5XX0sezE4OlsyLDM3XSwyNDpbMiwzN10sMzY6WzIsMzddfSx7Mzc6WzEsNjVdfSx7MjE6NjksMjk6NzMsMzE6WzEsNzBdLDMyOlsxLDcxXSwzMzpbMSw3Ml0sMzY6WzEsMjhdLDM4OlsxLDI3XSwzOToyNn0sezE4OlsyLDQ5XSwyNDpbMiw0OV0sMzE6WzIsNDldLDMyOlsyLDQ5XSwzMzpbMiw0OV0sMzY6WzIsNDldLDM4OlsyLDQ5XSw0MDpbMiw0OV19LHsxODpbMSw3NF19LHs1OlsyLDIyXSwxNDpbMiwyMl0sMTU6WzIsMjJdLDE2OlsyLDIyXSwxOTpbMiwyMl0sMjA6WzIsMjJdLDIyOlsyLDIyXSwyMzpbMiwyMl0sMjU6WzIsMjJdfSx7MTg6WzIsMzldLDI0OlsyLDM5XSwzNjpbMiwzOV19LHsxODpbMiw0MF0sMjQ6WzIsNDBdLDM2OlsyLDQwXX0sezE4OlsyLDQxXSwyNDpbMiw0MV0sMzY6WzIsNDFdfSx7MTg6WzIsNDJdLDI0OlsyLDQyXSwzNjpbMiw0Ml19LHsxODpbMiw0M10sMjQ6WzIsNDNdLDM2OlsyLDQzXX0sezU6WzIsMThdLDE0OlsyLDE4XSwxNTpbMiwxOF0sMTY6WzIsMThdLDE5OlsyLDE4XSwyMDpbMiwxOF0sMjI6WzIsMThdLDIzOlsyLDE4XSwyNTpbMiwxOF19XSxcbmRlZmF1bHRBY3Rpb25zOiB7MTc6WzIsMV19LFxucGFyc2VFcnJvcjogZnVuY3Rpb24gcGFyc2VFcnJvcihzdHIsIGhhc2gpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3Ioc3RyKTtcbn0sXG5wYXJzZTogZnVuY3Rpb24gcGFyc2UoaW5wdXQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsIHN0YWNrID0gWzBdLCB2c3RhY2sgPSBbbnVsbF0sIGxzdGFjayA9IFtdLCB0YWJsZSA9IHRoaXMudGFibGUsIHl5dGV4dCA9IFwiXCIsIHl5bGluZW5vID0gMCwgeXlsZW5nID0gMCwgcmVjb3ZlcmluZyA9IDAsIFRFUlJPUiA9IDIsIEVPRiA9IDE7XG4gICAgdGhpcy5sZXhlci5zZXRJbnB1dChpbnB1dCk7XG4gICAgdGhpcy5sZXhlci55eSA9IHRoaXMueXk7XG4gICAgdGhpcy55eS5sZXhlciA9IHRoaXMubGV4ZXI7XG4gICAgdGhpcy55eS5wYXJzZXIgPSB0aGlzO1xuICAgIGlmICh0eXBlb2YgdGhpcy5sZXhlci55eWxsb2MgPT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgdGhpcy5sZXhlci55eWxsb2MgPSB7fTtcbiAgICB2YXIgeXlsb2MgPSB0aGlzLmxleGVyLnl5bGxvYztcbiAgICBsc3RhY2sucHVzaCh5eWxvYyk7XG4gICAgdmFyIHJhbmdlcyA9IHRoaXMubGV4ZXIub3B0aW9ucyAmJiB0aGlzLmxleGVyLm9wdGlvbnMucmFuZ2VzO1xuICAgIGlmICh0eXBlb2YgdGhpcy55eS5wYXJzZUVycm9yID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgIHRoaXMucGFyc2VFcnJvciA9IHRoaXMueXkucGFyc2VFcnJvcjtcbiAgICBmdW5jdGlvbiBwb3BTdGFjayhuKSB7XG4gICAgICAgIHN0YWNrLmxlbmd0aCA9IHN0YWNrLmxlbmd0aCAtIDIgKiBuO1xuICAgICAgICB2c3RhY2subGVuZ3RoID0gdnN0YWNrLmxlbmd0aCAtIG47XG4gICAgICAgIGxzdGFjay5sZW5ndGggPSBsc3RhY2subGVuZ3RoIC0gbjtcbiAgICB9XG4gICAgZnVuY3Rpb24gbGV4KCkge1xuICAgICAgICB2YXIgdG9rZW47XG4gICAgICAgIHRva2VuID0gc2VsZi5sZXhlci5sZXgoKSB8fCAxO1xuICAgICAgICBpZiAodHlwZW9mIHRva2VuICE9PSBcIm51bWJlclwiKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHNlbGYuc3ltYm9sc19bdG9rZW5dIHx8IHRva2VuO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0b2tlbjtcbiAgICB9XG4gICAgdmFyIHN5bWJvbCwgcHJlRXJyb3JTeW1ib2wsIHN0YXRlLCBhY3Rpb24sIGEsIHIsIHl5dmFsID0ge30sIHAsIGxlbiwgbmV3U3RhdGUsIGV4cGVjdGVkO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgIHN0YXRlID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XG4gICAgICAgIGlmICh0aGlzLmRlZmF1bHRBY3Rpb25zW3N0YXRlXSkge1xuICAgICAgICAgICAgYWN0aW9uID0gdGhpcy5kZWZhdWx0QWN0aW9uc1tzdGF0ZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoc3ltYm9sID09PSBudWxsIHx8IHR5cGVvZiBzeW1ib2wgPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgICAgIHN5bWJvbCA9IGxleCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYWN0aW9uID0gdGFibGVbc3RhdGVdICYmIHRhYmxlW3N0YXRlXVtzeW1ib2xdO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgYWN0aW9uID09PSBcInVuZGVmaW5lZFwiIHx8ICFhY3Rpb24ubGVuZ3RoIHx8ICFhY3Rpb25bMF0pIHtcbiAgICAgICAgICAgIHZhciBlcnJTdHIgPSBcIlwiO1xuICAgICAgICAgICAgaWYgKCFyZWNvdmVyaW5nKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWQgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKHAgaW4gdGFibGVbc3RhdGVdKVxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy50ZXJtaW5hbHNfW3BdICYmIHAgPiAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RlZC5wdXNoKFwiJ1wiICsgdGhpcy50ZXJtaW5hbHNfW3BdICsgXCInXCIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubGV4ZXIuc2hvd1Bvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGVyclN0ciA9IFwiUGFyc2UgZXJyb3Igb24gbGluZSBcIiArICh5eWxpbmVubyArIDEpICsgXCI6XFxuXCIgKyB0aGlzLmxleGVyLnNob3dQb3NpdGlvbigpICsgXCJcXG5FeHBlY3RpbmcgXCIgKyBleHBlY3RlZC5qb2luKFwiLCBcIikgKyBcIiwgZ290ICdcIiArICh0aGlzLnRlcm1pbmFsc19bc3ltYm9sXSB8fCBzeW1ib2wpICsgXCInXCI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyU3RyID0gXCJQYXJzZSBlcnJvciBvbiBsaW5lIFwiICsgKHl5bGluZW5vICsgMSkgKyBcIjogVW5leHBlY3RlZCBcIiArIChzeW1ib2wgPT0gMT9cImVuZCBvZiBpbnB1dFwiOlwiJ1wiICsgKHRoaXMudGVybWluYWxzX1tzeW1ib2xdIHx8IHN5bWJvbCkgKyBcIidcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMucGFyc2VFcnJvcihlcnJTdHIsIHt0ZXh0OiB0aGlzLmxleGVyLm1hdGNoLCB0b2tlbjogdGhpcy50ZXJtaW5hbHNfW3N5bWJvbF0gfHwgc3ltYm9sLCBsaW5lOiB0aGlzLmxleGVyLnl5bGluZW5vLCBsb2M6IHl5bG9jLCBleHBlY3RlZDogZXhwZWN0ZWR9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoYWN0aW9uWzBdIGluc3RhbmNlb2YgQXJyYXkgJiYgYWN0aW9uLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlBhcnNlIEVycm9yOiBtdWx0aXBsZSBhY3Rpb25zIHBvc3NpYmxlIGF0IHN0YXRlOiBcIiArIHN0YXRlICsgXCIsIHRva2VuOiBcIiArIHN5bWJvbCk7XG4gICAgICAgIH1cbiAgICAgICAgc3dpdGNoIChhY3Rpb25bMF0pIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgc3RhY2sucHVzaChzeW1ib2wpO1xuICAgICAgICAgICAgdnN0YWNrLnB1c2godGhpcy5sZXhlci55eXRleHQpO1xuICAgICAgICAgICAgbHN0YWNrLnB1c2godGhpcy5sZXhlci55eWxsb2MpO1xuICAgICAgICAgICAgc3RhY2sucHVzaChhY3Rpb25bMV0pO1xuICAgICAgICAgICAgc3ltYm9sID0gbnVsbDtcbiAgICAgICAgICAgIGlmICghcHJlRXJyb3JTeW1ib2wpIHtcbiAgICAgICAgICAgICAgICB5eWxlbmcgPSB0aGlzLmxleGVyLnl5bGVuZztcbiAgICAgICAgICAgICAgICB5eXRleHQgPSB0aGlzLmxleGVyLnl5dGV4dDtcbiAgICAgICAgICAgICAgICB5eWxpbmVubyA9IHRoaXMubGV4ZXIueXlsaW5lbm87XG4gICAgICAgICAgICAgICAgeXlsb2MgPSB0aGlzLmxleGVyLnl5bGxvYztcbiAgICAgICAgICAgICAgICBpZiAocmVjb3ZlcmluZyA+IDApXG4gICAgICAgICAgICAgICAgICAgIHJlY292ZXJpbmctLTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3ltYm9sID0gcHJlRXJyb3JTeW1ib2w7XG4gICAgICAgICAgICAgICAgcHJlRXJyb3JTeW1ib2wgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgIGxlbiA9IHRoaXMucHJvZHVjdGlvbnNfW2FjdGlvblsxXV1bMV07XG4gICAgICAgICAgICB5eXZhbC4kID0gdnN0YWNrW3ZzdGFjay5sZW5ndGggLSBsZW5dO1xuICAgICAgICAgICAgeXl2YWwuXyQgPSB7Zmlyc3RfbGluZTogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAobGVuIHx8IDEpXS5maXJzdF9saW5lLCBsYXN0X2xpbmU6IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gMV0ubGFzdF9saW5lLCBmaXJzdF9jb2x1bW46IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gKGxlbiB8fCAxKV0uZmlyc3RfY29sdW1uLCBsYXN0X2NvbHVtbjogbHN0YWNrW2xzdGFjay5sZW5ndGggLSAxXS5sYXN0X2NvbHVtbn07XG4gICAgICAgICAgICBpZiAocmFuZ2VzKSB7XG4gICAgICAgICAgICAgICAgeXl2YWwuXyQucmFuZ2UgPSBbbHN0YWNrW2xzdGFjay5sZW5ndGggLSAobGVuIHx8IDEpXS5yYW5nZVswXSwgbHN0YWNrW2xzdGFjay5sZW5ndGggLSAxXS5yYW5nZVsxXV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByID0gdGhpcy5wZXJmb3JtQWN0aW9uLmNhbGwoeXl2YWwsIHl5dGV4dCwgeXlsZW5nLCB5eWxpbmVubywgdGhpcy55eSwgYWN0aW9uWzFdLCB2c3RhY2ssIGxzdGFjayk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHIgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICBzdGFjayA9IHN0YWNrLnNsaWNlKDAsIC0xICogbGVuICogMik7XG4gICAgICAgICAgICAgICAgdnN0YWNrID0gdnN0YWNrLnNsaWNlKDAsIC0xICogbGVuKTtcbiAgICAgICAgICAgICAgICBsc3RhY2sgPSBsc3RhY2suc2xpY2UoMCwgLTEgKiBsZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3RhY2sucHVzaCh0aGlzLnByb2R1Y3Rpb25zX1thY3Rpb25bMV1dWzBdKTtcbiAgICAgICAgICAgIHZzdGFjay5wdXNoKHl5dmFsLiQpO1xuICAgICAgICAgICAgbHN0YWNrLnB1c2goeXl2YWwuXyQpO1xuICAgICAgICAgICAgbmV3U3RhdGUgPSB0YWJsZVtzdGFja1tzdGFjay5sZW5ndGggLSAyXV1bc3RhY2tbc3RhY2subGVuZ3RoIC0gMV1dO1xuICAgICAgICAgICAgc3RhY2sucHVzaChuZXdTdGF0ZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59XG59O1xuLyogSmlzb24gZ2VuZXJhdGVkIGxleGVyICovXG52YXIgbGV4ZXIgPSAoZnVuY3Rpb24oKXtcbnZhciBsZXhlciA9ICh7RU9GOjEsXG5wYXJzZUVycm9yOmZ1bmN0aW9uIHBhcnNlRXJyb3Ioc3RyLCBoYXNoKSB7XG4gICAgICAgIGlmICh0aGlzLnl5LnBhcnNlcikge1xuICAgICAgICAgICAgdGhpcy55eS5wYXJzZXIucGFyc2VFcnJvcihzdHIsIGhhc2gpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHN0cik7XG4gICAgICAgIH1cbiAgICB9LFxuc2V0SW5wdXQ6ZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHRoaXMuX2lucHV0ID0gaW5wdXQ7XG4gICAgICAgIHRoaXMuX21vcmUgPSB0aGlzLl9sZXNzID0gdGhpcy5kb25lID0gZmFsc2U7XG4gICAgICAgIHRoaXMueXlsaW5lbm8gPSB0aGlzLnl5bGVuZyA9IDA7XG4gICAgICAgIHRoaXMueXl0ZXh0ID0gdGhpcy5tYXRjaGVkID0gdGhpcy5tYXRjaCA9ICcnO1xuICAgICAgICB0aGlzLmNvbmRpdGlvblN0YWNrID0gWydJTklUSUFMJ107XG4gICAgICAgIHRoaXMueXlsbG9jID0ge2ZpcnN0X2xpbmU6MSxmaXJzdF9jb2x1bW46MCxsYXN0X2xpbmU6MSxsYXN0X2NvbHVtbjowfTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHRoaXMueXlsbG9jLnJhbmdlID0gWzAsMF07XG4gICAgICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbmlucHV0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNoID0gdGhpcy5faW5wdXRbMF07XG4gICAgICAgIHRoaXMueXl0ZXh0ICs9IGNoO1xuICAgICAgICB0aGlzLnl5bGVuZysrO1xuICAgICAgICB0aGlzLm9mZnNldCsrO1xuICAgICAgICB0aGlzLm1hdGNoICs9IGNoO1xuICAgICAgICB0aGlzLm1hdGNoZWQgKz0gY2g7XG4gICAgICAgIHZhciBsaW5lcyA9IGNoLm1hdGNoKC8oPzpcXHJcXG4/fFxcbikuKi9nKTtcbiAgICAgICAgaWYgKGxpbmVzKSB7XG4gICAgICAgICAgICB0aGlzLnl5bGluZW5vKys7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYy5sYXN0X2xpbmUrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLmxhc3RfY29sdW1uKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHRoaXMueXlsbG9jLnJhbmdlWzFdKys7XG5cbiAgICAgICAgdGhpcy5faW5wdXQgPSB0aGlzLl9pbnB1dC5zbGljZSgxKTtcbiAgICAgICAgcmV0dXJuIGNoO1xuICAgIH0sXG51bnB1dDpmdW5jdGlvbiAoY2gpIHtcbiAgICAgICAgdmFyIGxlbiA9IGNoLmxlbmd0aDtcbiAgICAgICAgdmFyIGxpbmVzID0gY2guc3BsaXQoLyg/Olxcclxcbj98XFxuKS9nKTtcblxuICAgICAgICB0aGlzLl9pbnB1dCA9IGNoICsgdGhpcy5faW5wdXQ7XG4gICAgICAgIHRoaXMueXl0ZXh0ID0gdGhpcy55eXRleHQuc3Vic3RyKDAsIHRoaXMueXl0ZXh0Lmxlbmd0aC1sZW4tMSk7XG4gICAgICAgIC8vdGhpcy55eWxlbmcgLT0gbGVuO1xuICAgICAgICB0aGlzLm9mZnNldCAtPSBsZW47XG4gICAgICAgIHZhciBvbGRMaW5lcyA9IHRoaXMubWF0Y2guc3BsaXQoLyg/Olxcclxcbj98XFxuKS9nKTtcbiAgICAgICAgdGhpcy5tYXRjaCA9IHRoaXMubWF0Y2guc3Vic3RyKDAsIHRoaXMubWF0Y2gubGVuZ3RoLTEpO1xuICAgICAgICB0aGlzLm1hdGNoZWQgPSB0aGlzLm1hdGNoZWQuc3Vic3RyKDAsIHRoaXMubWF0Y2hlZC5sZW5ndGgtMSk7XG5cbiAgICAgICAgaWYgKGxpbmVzLmxlbmd0aC0xKSB0aGlzLnl5bGluZW5vIC09IGxpbmVzLmxlbmd0aC0xO1xuICAgICAgICB2YXIgciA9IHRoaXMueXlsbG9jLnJhbmdlO1xuXG4gICAgICAgIHRoaXMueXlsbG9jID0ge2ZpcnN0X2xpbmU6IHRoaXMueXlsbG9jLmZpcnN0X2xpbmUsXG4gICAgICAgICAgbGFzdF9saW5lOiB0aGlzLnl5bGluZW5vKzEsXG4gICAgICAgICAgZmlyc3RfY29sdW1uOiB0aGlzLnl5bGxvYy5maXJzdF9jb2x1bW4sXG4gICAgICAgICAgbGFzdF9jb2x1bW46IGxpbmVzID9cbiAgICAgICAgICAgICAgKGxpbmVzLmxlbmd0aCA9PT0gb2xkTGluZXMubGVuZ3RoID8gdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uIDogMCkgKyBvbGRMaW5lc1tvbGRMaW5lcy5sZW5ndGggLSBsaW5lcy5sZW5ndGhdLmxlbmd0aCAtIGxpbmVzWzBdLmxlbmd0aDpcbiAgICAgICAgICAgICAgdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uIC0gbGVuXG4gICAgICAgICAgfTtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykge1xuICAgICAgICAgICAgdGhpcy55eWxsb2MucmFuZ2UgPSBbclswXSwgclswXSArIHRoaXMueXlsZW5nIC0gbGVuXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxubW9yZTpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuX21vcmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxubGVzczpmdW5jdGlvbiAobikge1xuICAgICAgICB0aGlzLnVucHV0KHRoaXMubWF0Y2guc2xpY2UobikpO1xuICAgIH0sXG5wYXN0SW5wdXQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcGFzdCA9IHRoaXMubWF0Y2hlZC5zdWJzdHIoMCwgdGhpcy5tYXRjaGVkLmxlbmd0aCAtIHRoaXMubWF0Y2gubGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIChwYXN0Lmxlbmd0aCA+IDIwID8gJy4uLic6JycpICsgcGFzdC5zdWJzdHIoLTIwKS5yZXBsYWNlKC9cXG4vZywgXCJcIik7XG4gICAgfSxcbnVwY29taW5nSW5wdXQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbmV4dCA9IHRoaXMubWF0Y2g7XG4gICAgICAgIGlmIChuZXh0Lmxlbmd0aCA8IDIwKSB7XG4gICAgICAgICAgICBuZXh0ICs9IHRoaXMuX2lucHV0LnN1YnN0cigwLCAyMC1uZXh0Lmxlbmd0aCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChuZXh0LnN1YnN0cigwLDIwKSsobmV4dC5sZW5ndGggPiAyMCA/ICcuLi4nOicnKSkucmVwbGFjZSgvXFxuL2csIFwiXCIpO1xuICAgIH0sXG5zaG93UG9zaXRpb246ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcHJlID0gdGhpcy5wYXN0SW5wdXQoKTtcbiAgICAgICAgdmFyIGMgPSBuZXcgQXJyYXkocHJlLmxlbmd0aCArIDEpLmpvaW4oXCItXCIpO1xuICAgICAgICByZXR1cm4gcHJlICsgdGhpcy51cGNvbWluZ0lucHV0KCkgKyBcIlxcblwiICsgYytcIl5cIjtcbiAgICB9LFxubmV4dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLmRvbmUpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLkVPRjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuX2lucHV0KSB0aGlzLmRvbmUgPSB0cnVlO1xuXG4gICAgICAgIHZhciB0b2tlbixcbiAgICAgICAgICAgIG1hdGNoLFxuICAgICAgICAgICAgdGVtcE1hdGNoLFxuICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICBjb2wsXG4gICAgICAgICAgICBsaW5lcztcbiAgICAgICAgaWYgKCF0aGlzLl9tb3JlKSB7XG4gICAgICAgICAgICB0aGlzLnl5dGV4dCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5tYXRjaCA9ICcnO1xuICAgICAgICB9XG4gICAgICAgIHZhciBydWxlcyA9IHRoaXMuX2N1cnJlbnRSdWxlcygpO1xuICAgICAgICBmb3IgKHZhciBpPTA7aSA8IHJ1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0ZW1wTWF0Y2ggPSB0aGlzLl9pbnB1dC5tYXRjaCh0aGlzLnJ1bGVzW3J1bGVzW2ldXSk7XG4gICAgICAgICAgICBpZiAodGVtcE1hdGNoICYmICghbWF0Y2ggfHwgdGVtcE1hdGNoWzBdLmxlbmd0aCA+IG1hdGNoWzBdLmxlbmd0aCkpIHtcbiAgICAgICAgICAgICAgICBtYXRjaCA9IHRlbXBNYXRjaDtcbiAgICAgICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuZmxleCkgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICBsaW5lcyA9IG1hdGNoWzBdLm1hdGNoKC8oPzpcXHJcXG4/fFxcbikuKi9nKTtcbiAgICAgICAgICAgIGlmIChsaW5lcykgdGhpcy55eWxpbmVubyArPSBsaW5lcy5sZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYyA9IHtmaXJzdF9saW5lOiB0aGlzLnl5bGxvYy5sYXN0X2xpbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0X2xpbmU6IHRoaXMueXlsaW5lbm8rMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogdGhpcy55eWxsb2MubGFzdF9jb2x1bW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0X2NvbHVtbjogbGluZXMgPyBsaW5lc1tsaW5lcy5sZW5ndGgtMV0ubGVuZ3RoLWxpbmVzW2xpbmVzLmxlbmd0aC0xXS5tYXRjaCgvXFxyP1xcbj8vKVswXS5sZW5ndGggOiB0aGlzLnl5bGxvYy5sYXN0X2NvbHVtbiArIG1hdGNoWzBdLmxlbmd0aH07XG4gICAgICAgICAgICB0aGlzLnl5dGV4dCArPSBtYXRjaFswXTtcbiAgICAgICAgICAgIHRoaXMubWF0Y2ggKz0gbWF0Y2hbMF07XG4gICAgICAgICAgICB0aGlzLm1hdGNoZXMgPSBtYXRjaDtcbiAgICAgICAgICAgIHRoaXMueXlsZW5nID0gdGhpcy55eXRleHQubGVuZ3RoO1xuICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnl5bGxvYy5yYW5nZSA9IFt0aGlzLm9mZnNldCwgdGhpcy5vZmZzZXQgKz0gdGhpcy55eWxlbmddO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fbW9yZSA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5faW5wdXQgPSB0aGlzLl9pbnB1dC5zbGljZShtYXRjaFswXS5sZW5ndGgpO1xuICAgICAgICAgICAgdGhpcy5tYXRjaGVkICs9IG1hdGNoWzBdO1xuICAgICAgICAgICAgdG9rZW4gPSB0aGlzLnBlcmZvcm1BY3Rpb24uY2FsbCh0aGlzLCB0aGlzLnl5LCB0aGlzLCBydWxlc1tpbmRleF0sdGhpcy5jb25kaXRpb25TdGFja1t0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aC0xXSk7XG4gICAgICAgICAgICBpZiAodGhpcy5kb25lICYmIHRoaXMuX2lucHV0KSB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh0b2tlbikgcmV0dXJuIHRva2VuO1xuICAgICAgICAgICAgZWxzZSByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX2lucHV0ID09PSBcIlwiKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5FT0Y7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJzZUVycm9yKCdMZXhpY2FsIGVycm9yIG9uIGxpbmUgJysodGhpcy55eWxpbmVubysxKSsnLiBVbnJlY29nbml6ZWQgdGV4dC5cXG4nK3RoaXMuc2hvd1Bvc2l0aW9uKCksXG4gICAgICAgICAgICAgICAgICAgIHt0ZXh0OiBcIlwiLCB0b2tlbjogbnVsbCwgbGluZTogdGhpcy55eWxpbmVub30pO1xuICAgICAgICB9XG4gICAgfSxcbmxleDpmdW5jdGlvbiBsZXgoKSB7XG4gICAgICAgIHZhciByID0gdGhpcy5uZXh0KCk7XG4gICAgICAgIGlmICh0eXBlb2YgciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGV4KCk7XG4gICAgICAgIH1cbiAgICB9LFxuYmVnaW46ZnVuY3Rpb24gYmVnaW4oY29uZGl0aW9uKSB7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uU3RhY2sucHVzaChjb25kaXRpb24pO1xuICAgIH0sXG5wb3BTdGF0ZTpmdW5jdGlvbiBwb3BTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uU3RhY2sucG9wKCk7XG4gICAgfSxcbl9jdXJyZW50UnVsZXM6ZnVuY3Rpb24gX2N1cnJlbnRSdWxlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uc1t0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoLTFdXS5ydWxlcztcbiAgICB9LFxudG9wU3RhdGU6ZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25kaXRpb25TdGFja1t0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aC0yXTtcbiAgICB9LFxucHVzaFN0YXRlOmZ1bmN0aW9uIGJlZ2luKGNvbmRpdGlvbikge1xuICAgICAgICB0aGlzLmJlZ2luKGNvbmRpdGlvbik7XG4gICAgfX0pO1xubGV4ZXIub3B0aW9ucyA9IHt9O1xubGV4ZXIucGVyZm9ybUFjdGlvbiA9IGZ1bmN0aW9uIGFub255bW91cyh5eSx5eV8sJGF2b2lkaW5nX25hbWVfY29sbGlzaW9ucyxZWV9TVEFSVCkge1xuXG52YXIgWVlTVEFURT1ZWV9TVEFSVFxuc3dpdGNoKCRhdm9pZGluZ19uYW1lX2NvbGxpc2lvbnMpIHtcbmNhc2UgMDogeXlfLnl5dGV4dCA9IFwiXFxcXFwiOyByZXR1cm4gMTQ7IFxuYnJlYWs7XG5jYXNlIDE6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHl5Xy55eXRleHQuc2xpY2UoLTEpICE9PSBcIlxcXFxcIikgdGhpcy5iZWdpbihcIm11XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZih5eV8ueXl0ZXh0LnNsaWNlKC0xKSA9PT0gXCJcXFxcXCIpIHl5Xy55eXRleHQgPSB5eV8ueXl0ZXh0LnN1YnN0cigwLHl5Xy55eWxlbmctMSksIHRoaXMuYmVnaW4oXCJlbXVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHl5Xy55eXRleHQpIHJldHVybiAxNDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuYnJlYWs7XG5jYXNlIDI6IHJldHVybiAxNDsgXG5icmVhaztcbmNhc2UgMzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoeXlfLnl5dGV4dC5zbGljZSgtMSkgIT09IFwiXFxcXFwiKSB0aGlzLnBvcFN0YXRlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHl5Xy55eXRleHQuc2xpY2UoLTEpID09PSBcIlxcXFxcIikgeXlfLnl5dGV4dCA9IHl5Xy55eXRleHQuc3Vic3RyKDAseXlfLnl5bGVuZy0xKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDE0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG5icmVhaztcbmNhc2UgNDogeXlfLnl5dGV4dCA9IHl5Xy55eXRleHQuc3Vic3RyKDAsIHl5Xy55eWxlbmctNCk7IHRoaXMucG9wU3RhdGUoKTsgcmV0dXJuIDE1OyBcbmJyZWFrO1xuY2FzZSA1OiByZXR1cm4gMjU7IFxuYnJlYWs7XG5jYXNlIDY6IHJldHVybiAxNjsgXG5icmVhaztcbmNhc2UgNzogcmV0dXJuIDIwOyBcbmJyZWFrO1xuY2FzZSA4OiByZXR1cm4gMTk7IFxuYnJlYWs7XG5jYXNlIDk6IHJldHVybiAxOTsgXG5icmVhaztcbmNhc2UgMTA6IHJldHVybiAyMzsgXG5icmVhaztcbmNhc2UgMTE6IHJldHVybiAyMjsgXG5icmVhaztcbmNhc2UgMTI6IHRoaXMucG9wU3RhdGUoKTsgdGhpcy5iZWdpbignY29tJyk7IFxuYnJlYWs7XG5jYXNlIDEzOiB5eV8ueXl0ZXh0ID0geXlfLnl5dGV4dC5zdWJzdHIoMyx5eV8ueXlsZW5nLTUpOyB0aGlzLnBvcFN0YXRlKCk7IHJldHVybiAxNTsgXG5icmVhaztcbmNhc2UgMTQ6IHJldHVybiAyMjsgXG5icmVhaztcbmNhc2UgMTU6IHJldHVybiAzNzsgXG5icmVhaztcbmNhc2UgMTY6IHJldHVybiAzNjsgXG5icmVhaztcbmNhc2UgMTc6IHJldHVybiAzNjsgXG5icmVhaztcbmNhc2UgMTg6IHJldHVybiA0MDsgXG5icmVhaztcbmNhc2UgMTk6IC8qaWdub3JlIHdoaXRlc3BhY2UqLyBcbmJyZWFrO1xuY2FzZSAyMDogdGhpcy5wb3BTdGF0ZSgpOyByZXR1cm4gMjQ7IFxuYnJlYWs7XG5jYXNlIDIxOiB0aGlzLnBvcFN0YXRlKCk7IHJldHVybiAxODsgXG5icmVhaztcbmNhc2UgMjI6IHl5Xy55eXRleHQgPSB5eV8ueXl0ZXh0LnN1YnN0cigxLHl5Xy55eWxlbmctMikucmVwbGFjZSgvXFxcXFwiL2csJ1wiJyk7IHJldHVybiAzMTsgXG5icmVhaztcbmNhc2UgMjM6IHl5Xy55eXRleHQgPSB5eV8ueXl0ZXh0LnN1YnN0cigxLHl5Xy55eWxlbmctMikucmVwbGFjZSgvXFxcXCcvZyxcIidcIik7IHJldHVybiAzMTsgXG5icmVhaztcbmNhc2UgMjQ6IHJldHVybiAzODsgXG5icmVhaztcbmNhc2UgMjU6IHJldHVybiAzMzsgXG5icmVhaztcbmNhc2UgMjY6IHJldHVybiAzMzsgXG5icmVhaztcbmNhc2UgMjc6IHJldHVybiAzMjsgXG5icmVhaztcbmNhc2UgMjg6IHJldHVybiAzNjsgXG5icmVhaztcbmNhc2UgMjk6IHl5Xy55eXRleHQgPSB5eV8ueXl0ZXh0LnN1YnN0cigxLCB5eV8ueXlsZW5nLTIpOyByZXR1cm4gMzY7IFxuYnJlYWs7XG5jYXNlIDMwOiByZXR1cm4gJ0lOVkFMSUQnOyBcbmJyZWFrO1xuY2FzZSAzMTogcmV0dXJuIDU7IFxuYnJlYWs7XG59XG59O1xubGV4ZXIucnVsZXMgPSBbL14oPzpcXFxcXFxcXCg/PShcXHtcXHspKSkvLC9eKD86W15cXHgwMF0qPyg/PShcXHtcXHspKSkvLC9eKD86W15cXHgwMF0rKS8sL14oPzpbXlxceDAwXXsyLH0/KD89KFxce1xce3wkKSkpLywvXig/OltcXHNcXFNdKj8tLVxcfVxcfSkvLC9eKD86XFx7XFx7PikvLC9eKD86XFx7XFx7IykvLC9eKD86XFx7XFx7XFwvKS8sL14oPzpcXHtcXHtcXF4pLywvXig/Olxce1xce1xccyplbHNlXFxiKS8sL14oPzpcXHtcXHtcXHspLywvXig/Olxce1xceyYpLywvXig/Olxce1xceyEtLSkvLC9eKD86XFx7XFx7IVtcXHNcXFNdKj9cXH1cXH0pLywvXig/Olxce1xceykvLC9eKD86PSkvLC9eKD86XFwuKD89W31cXC8gXSkpLywvXig/OlxcLlxcLikvLC9eKD86W1xcLy5dKS8sL14oPzpcXHMrKS8sL14oPzpcXH1cXH1cXH0pLywvXig/OlxcfVxcfSkvLC9eKD86XCIoXFxcXFtcIl18W15cIl0pKlwiKS8sL14oPzonKFxcXFxbJ118W14nXSkqJykvLC9eKD86QCkvLC9eKD86dHJ1ZSg/PVt9XFxzXSkpLywvXig/OmZhbHNlKD89W31cXHNdKSkvLC9eKD86LT9bMC05XSsoPz1bfVxcc10pKS8sL14oPzpbXlxccyFcIiMlLSxcXC5cXC87LT5AXFxbLVxcXmBcXHstfl0rKD89Wz19XFxzXFwvLl0pKS8sL14oPzpcXFtbXlxcXV0qXFxdKS8sL14oPzouKS8sL14oPzokKS9dO1xubGV4ZXIuY29uZGl0aW9ucyA9IHtcIm11XCI6e1wicnVsZXNcIjpbNSw2LDcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4LDE5LDIwLDIxLDIyLDIzLDI0LDI1LDI2LDI3LDI4LDI5LDMwLDMxXSxcImluY2x1c2l2ZVwiOmZhbHNlfSxcImVtdVwiOntcInJ1bGVzXCI6WzNdLFwiaW5jbHVzaXZlXCI6ZmFsc2V9LFwiY29tXCI6e1wicnVsZXNcIjpbNF0sXCJpbmNsdXNpdmVcIjpmYWxzZX0sXCJJTklUSUFMXCI6e1wicnVsZXNcIjpbMCwxLDIsMzFdLFwiaW5jbHVzaXZlXCI6dHJ1ZX19O1xucmV0dXJuIGxleGVyO30pKClcbnBhcnNlci5sZXhlciA9IGxleGVyO1xuZnVuY3Rpb24gUGFyc2VyICgpIHsgdGhpcy55eSA9IHt9OyB9UGFyc2VyLnByb3RvdHlwZSA9IHBhcnNlcjtwYXJzZXIuUGFyc2VyID0gUGFyc2VyO1xucmV0dXJuIG5ldyBQYXJzZXI7XG59KSgpO1xuLy8gRU5EKEJST1dTRVIpXG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlYmFycztcbiIsImV4cG9ydHMuYXR0YWNoID0gZnVuY3Rpb24oSGFuZGxlYmFycykge1xuXG4vLyBCRUdJTihCUk9XU0VSKVxuXG5IYW5kbGViYXJzLnByaW50ID0gZnVuY3Rpb24oYXN0KSB7XG4gIHJldHVybiBuZXcgSGFuZGxlYmFycy5QcmludFZpc2l0b3IoKS5hY2NlcHQoYXN0KTtcbn07XG5cbkhhbmRsZWJhcnMuUHJpbnRWaXNpdG9yID0gZnVuY3Rpb24oKSB7IHRoaXMucGFkZGluZyA9IDA7IH07XG5IYW5kbGViYXJzLlByaW50VmlzaXRvci5wcm90b3R5cGUgPSBuZXcgSGFuZGxlYmFycy5WaXNpdG9yKCk7XG5cbkhhbmRsZWJhcnMuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5wYWQgPSBmdW5jdGlvbihzdHJpbmcsIG5ld2xpbmUpIHtcbiAgdmFyIG91dCA9IFwiXCI7XG5cbiAgZm9yKHZhciBpPTAsbD10aGlzLnBhZGRpbmc7IGk8bDsgaSsrKSB7XG4gICAgb3V0ID0gb3V0ICsgXCIgIFwiO1xuICB9XG5cbiAgb3V0ID0gb3V0ICsgc3RyaW5nO1xuXG4gIGlmKG5ld2xpbmUgIT09IGZhbHNlKSB7IG91dCA9IG91dCArIFwiXFxuXCI7IH1cbiAgcmV0dXJuIG91dDtcbn07XG5cbkhhbmRsZWJhcnMuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5wcm9ncmFtID0gZnVuY3Rpb24ocHJvZ3JhbSkge1xuICB2YXIgb3V0ID0gXCJcIixcbiAgICAgIHN0YXRlbWVudHMgPSBwcm9ncmFtLnN0YXRlbWVudHMsXG4gICAgICBpbnZlcnNlID0gcHJvZ3JhbS5pbnZlcnNlLFxuICAgICAgaSwgbDtcblxuICBmb3IoaT0wLCBsPXN0YXRlbWVudHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgIG91dCA9IG91dCArIHRoaXMuYWNjZXB0KHN0YXRlbWVudHNbaV0pO1xuICB9XG5cbiAgdGhpcy5wYWRkaW5nLS07XG5cbiAgcmV0dXJuIG91dDtcbn07XG5cbkhhbmRsZWJhcnMuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5ibG9jayA9IGZ1bmN0aW9uKGJsb2NrKSB7XG4gIHZhciBvdXQgPSBcIlwiO1xuXG4gIG91dCA9IG91dCArIHRoaXMucGFkKFwiQkxPQ0s6XCIpO1xuICB0aGlzLnBhZGRpbmcrKztcbiAgb3V0ID0gb3V0ICsgdGhpcy5hY2NlcHQoYmxvY2subXVzdGFjaGUpO1xuICBpZiAoYmxvY2sucHJvZ3JhbSkge1xuICAgIG91dCA9IG91dCArIHRoaXMucGFkKFwiUFJPR1JBTTpcIik7XG4gICAgdGhpcy5wYWRkaW5nKys7XG4gICAgb3V0ID0gb3V0ICsgdGhpcy5hY2NlcHQoYmxvY2sucHJvZ3JhbSk7XG4gICAgdGhpcy5wYWRkaW5nLS07XG4gIH1cbiAgaWYgKGJsb2NrLmludmVyc2UpIHtcbiAgICBpZiAoYmxvY2sucHJvZ3JhbSkgeyB0aGlzLnBhZGRpbmcrKzsgfVxuICAgIG91dCA9IG91dCArIHRoaXMucGFkKFwie3tefX1cIik7XG4gICAgdGhpcy5wYWRkaW5nKys7XG4gICAgb3V0ID0gb3V0ICsgdGhpcy5hY2NlcHQoYmxvY2suaW52ZXJzZSk7XG4gICAgdGhpcy5wYWRkaW5nLS07XG4gICAgaWYgKGJsb2NrLnByb2dyYW0pIHsgdGhpcy5wYWRkaW5nLS07IH1cbiAgfVxuICB0aGlzLnBhZGRpbmctLTtcblxuICByZXR1cm4gb3V0O1xufTtcblxuSGFuZGxlYmFycy5QcmludFZpc2l0b3IucHJvdG90eXBlLm11c3RhY2hlID0gZnVuY3Rpb24obXVzdGFjaGUpIHtcbiAgdmFyIHBhcmFtcyA9IG11c3RhY2hlLnBhcmFtcywgcGFyYW1TdHJpbmdzID0gW10sIGhhc2g7XG5cbiAgZm9yKHZhciBpPTAsIGw9cGFyYW1zLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICBwYXJhbVN0cmluZ3MucHVzaCh0aGlzLmFjY2VwdChwYXJhbXNbaV0pKTtcbiAgfVxuXG4gIHBhcmFtcyA9IFwiW1wiICsgcGFyYW1TdHJpbmdzLmpvaW4oXCIsIFwiKSArIFwiXVwiO1xuXG4gIGhhc2ggPSBtdXN0YWNoZS5oYXNoID8gXCIgXCIgKyB0aGlzLmFjY2VwdChtdXN0YWNoZS5oYXNoKSA6IFwiXCI7XG5cbiAgcmV0dXJuIHRoaXMucGFkKFwie3sgXCIgKyB0aGlzLmFjY2VwdChtdXN0YWNoZS5pZCkgKyBcIiBcIiArIHBhcmFtcyArIGhhc2ggKyBcIiB9fVwiKTtcbn07XG5cbkhhbmRsZWJhcnMuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5wYXJ0aWFsID0gZnVuY3Rpb24ocGFydGlhbCkge1xuICB2YXIgY29udGVudCA9IHRoaXMuYWNjZXB0KHBhcnRpYWwucGFydGlhbE5hbWUpO1xuICBpZihwYXJ0aWFsLmNvbnRleHQpIHsgY29udGVudCA9IGNvbnRlbnQgKyBcIiBcIiArIHRoaXMuYWNjZXB0KHBhcnRpYWwuY29udGV4dCk7IH1cbiAgcmV0dXJuIHRoaXMucGFkKFwie3s+IFwiICsgY29udGVudCArIFwiIH19XCIpO1xufTtcblxuSGFuZGxlYmFycy5QcmludFZpc2l0b3IucHJvdG90eXBlLmhhc2ggPSBmdW5jdGlvbihoYXNoKSB7XG4gIHZhciBwYWlycyA9IGhhc2gucGFpcnM7XG4gIHZhciBqb2luZWRQYWlycyA9IFtdLCBsZWZ0LCByaWdodDtcblxuICBmb3IodmFyIGk9MCwgbD1wYWlycy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgbGVmdCA9IHBhaXJzW2ldWzBdO1xuICAgIHJpZ2h0ID0gdGhpcy5hY2NlcHQocGFpcnNbaV1bMV0pO1xuICAgIGpvaW5lZFBhaXJzLnB1c2goIGxlZnQgKyBcIj1cIiArIHJpZ2h0ICk7XG4gIH1cblxuICByZXR1cm4gXCJIQVNIe1wiICsgam9pbmVkUGFpcnMuam9pbihcIiwgXCIpICsgXCJ9XCI7XG59O1xuXG5IYW5kbGViYXJzLlByaW50VmlzaXRvci5wcm90b3R5cGUuU1RSSU5HID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gIHJldHVybiAnXCInICsgc3RyaW5nLnN0cmluZyArICdcIic7XG59O1xuXG5IYW5kbGViYXJzLlByaW50VmlzaXRvci5wcm90b3R5cGUuSU5URUdFUiA9IGZ1bmN0aW9uKGludGVnZXIpIHtcbiAgcmV0dXJuIFwiSU5URUdFUntcIiArIGludGVnZXIuaW50ZWdlciArIFwifVwiO1xufTtcblxuSGFuZGxlYmFycy5QcmludFZpc2l0b3IucHJvdG90eXBlLkJPT0xFQU4gPSBmdW5jdGlvbihib29sKSB7XG4gIHJldHVybiBcIkJPT0xFQU57XCIgKyBib29sLmJvb2wgKyBcIn1cIjtcbn07XG5cbkhhbmRsZWJhcnMuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5JRCA9IGZ1bmN0aW9uKGlkKSB7XG4gIHZhciBwYXRoID0gaWQucGFydHMuam9pbihcIi9cIik7XG4gIGlmKGlkLnBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICByZXR1cm4gXCJQQVRIOlwiICsgcGF0aDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gXCJJRDpcIiArIHBhdGg7XG4gIH1cbn07XG5cbkhhbmRsZWJhcnMuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5QQVJUSUFMX05BTUUgPSBmdW5jdGlvbihwYXJ0aWFsTmFtZSkge1xuICAgIHJldHVybiBcIlBBUlRJQUw6XCIgKyBwYXJ0aWFsTmFtZS5uYW1lO1xufTtcblxuSGFuZGxlYmFycy5QcmludFZpc2l0b3IucHJvdG90eXBlLkRBVEEgPSBmdW5jdGlvbihkYXRhKSB7XG4gIHJldHVybiBcIkBcIiArIHRoaXMuYWNjZXB0KGRhdGEuaWQpO1xufTtcblxuSGFuZGxlYmFycy5QcmludFZpc2l0b3IucHJvdG90eXBlLmNvbnRlbnQgPSBmdW5jdGlvbihjb250ZW50KSB7XG4gIHJldHVybiB0aGlzLnBhZChcIkNPTlRFTlRbICdcIiArIGNvbnRlbnQuc3RyaW5nICsgXCInIF1cIik7XG59O1xuXG5IYW5kbGViYXJzLlByaW50VmlzaXRvci5wcm90b3R5cGUuY29tbWVudCA9IGZ1bmN0aW9uKGNvbW1lbnQpIHtcbiAgcmV0dXJuIHRoaXMucGFkKFwie3shICdcIiArIGNvbW1lbnQuY29tbWVudCArIFwiJyB9fVwiKTtcbn07XG4vLyBFTkQoQlJPV1NFUilcblxucmV0dXJuIEhhbmRsZWJhcnM7XG59O1xuXG4iLCJleHBvcnRzLmF0dGFjaCA9IGZ1bmN0aW9uKEhhbmRsZWJhcnMpIHtcblxuLy8gQkVHSU4oQlJPV1NFUilcblxuSGFuZGxlYmFycy5WaXNpdG9yID0gZnVuY3Rpb24oKSB7fTtcblxuSGFuZGxlYmFycy5WaXNpdG9yLnByb3RvdHlwZSA9IHtcbiAgYWNjZXB0OiBmdW5jdGlvbihvYmplY3QpIHtcbiAgICByZXR1cm4gdGhpc1tvYmplY3QudHlwZV0ob2JqZWN0KTtcbiAgfVxufTtcblxuLy8gRU5EKEJST1dTRVIpXG5cbnJldHVybiBIYW5kbGViYXJzO1xufTtcblxuXG4iLCJleHBvcnRzLmF0dGFjaCA9IGZ1bmN0aW9uKEhhbmRsZWJhcnMpIHtcblxuLy8gQkVHSU4oQlJPV1NFUilcblxuSGFuZGxlYmFycy5WTSA9IHtcbiAgdGVtcGxhdGU6IGZ1bmN0aW9uKHRlbXBsYXRlU3BlYykge1xuICAgIC8vIEp1c3QgYWRkIHdhdGVyXG4gICAgdmFyIGNvbnRhaW5lciA9IHtcbiAgICAgIGVzY2FwZUV4cHJlc3Npb246IEhhbmRsZWJhcnMuVXRpbHMuZXNjYXBlRXhwcmVzc2lvbixcbiAgICAgIGludm9rZVBhcnRpYWw6IEhhbmRsZWJhcnMuVk0uaW52b2tlUGFydGlhbCxcbiAgICAgIHByb2dyYW1zOiBbXSxcbiAgICAgIHByb2dyYW06IGZ1bmN0aW9uKGksIGZuLCBkYXRhKSB7XG4gICAgICAgIHZhciBwcm9ncmFtV3JhcHBlciA9IHRoaXMucHJvZ3JhbXNbaV07XG4gICAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgICBwcm9ncmFtV3JhcHBlciA9IEhhbmRsZWJhcnMuVk0ucHJvZ3JhbShpLCBmbiwgZGF0YSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIXByb2dyYW1XcmFwcGVyKSB7XG4gICAgICAgICAgcHJvZ3JhbVdyYXBwZXIgPSB0aGlzLnByb2dyYW1zW2ldID0gSGFuZGxlYmFycy5WTS5wcm9ncmFtKGksIGZuKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJvZ3JhbVdyYXBwZXI7XG4gICAgICB9LFxuICAgICAgbWVyZ2U6IGZ1bmN0aW9uKHBhcmFtLCBjb21tb24pIHtcbiAgICAgICAgdmFyIHJldCA9IHBhcmFtIHx8IGNvbW1vbjtcblxuICAgICAgICBpZiAocGFyYW0gJiYgY29tbW9uKSB7XG4gICAgICAgICAgcmV0ID0ge307XG4gICAgICAgICAgSGFuZGxlYmFycy5VdGlscy5leHRlbmQocmV0LCBjb21tb24pO1xuICAgICAgICAgIEhhbmRsZWJhcnMuVXRpbHMuZXh0ZW5kKHJldCwgcGFyYW0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXQ7XG4gICAgICB9LFxuICAgICAgcHJvZ3JhbVdpdGhEZXB0aDogSGFuZGxlYmFycy5WTS5wcm9ncmFtV2l0aERlcHRoLFxuICAgICAgbm9vcDogSGFuZGxlYmFycy5WTS5ub29wLFxuICAgICAgY29tcGlsZXJJbmZvOiBudWxsXG4gICAgfTtcblxuICAgIHJldHVybiBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgIHZhciByZXN1bHQgPSB0ZW1wbGF0ZVNwZWMuY2FsbChjb250YWluZXIsIEhhbmRsZWJhcnMsIGNvbnRleHQsIG9wdGlvbnMuaGVscGVycywgb3B0aW9ucy5wYXJ0aWFscywgb3B0aW9ucy5kYXRhKTtcblxuICAgICAgdmFyIGNvbXBpbGVySW5mbyA9IGNvbnRhaW5lci5jb21waWxlckluZm8gfHwgW10sXG4gICAgICAgICAgY29tcGlsZXJSZXZpc2lvbiA9IGNvbXBpbGVySW5mb1swXSB8fCAxLFxuICAgICAgICAgIGN1cnJlbnRSZXZpc2lvbiA9IEhhbmRsZWJhcnMuQ09NUElMRVJfUkVWSVNJT047XG5cbiAgICAgIGlmIChjb21waWxlclJldmlzaW9uICE9PSBjdXJyZW50UmV2aXNpb24pIHtcbiAgICAgICAgaWYgKGNvbXBpbGVyUmV2aXNpb24gPCBjdXJyZW50UmV2aXNpb24pIHtcbiAgICAgICAgICB2YXIgcnVudGltZVZlcnNpb25zID0gSGFuZGxlYmFycy5SRVZJU0lPTl9DSEFOR0VTW2N1cnJlbnRSZXZpc2lvbl0sXG4gICAgICAgICAgICAgIGNvbXBpbGVyVmVyc2lvbnMgPSBIYW5kbGViYXJzLlJFVklTSU9OX0NIQU5HRVNbY29tcGlsZXJSZXZpc2lvbl07XG4gICAgICAgICAgdGhyb3cgXCJUZW1wbGF0ZSB3YXMgcHJlY29tcGlsZWQgd2l0aCBhbiBvbGRlciB2ZXJzaW9uIG9mIEhhbmRsZWJhcnMgdGhhbiB0aGUgY3VycmVudCBydW50aW1lLiBcIitcbiAgICAgICAgICAgICAgICBcIlBsZWFzZSB1cGRhdGUgeW91ciBwcmVjb21waWxlciB0byBhIG5ld2VyIHZlcnNpb24gKFwiK3J1bnRpbWVWZXJzaW9ucytcIikgb3IgZG93bmdyYWRlIHlvdXIgcnVudGltZSB0byBhbiBvbGRlciB2ZXJzaW9uIChcIitjb21waWxlclZlcnNpb25zK1wiKS5cIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBVc2UgdGhlIGVtYmVkZGVkIHZlcnNpb24gaW5mbyBzaW5jZSB0aGUgcnVudGltZSBkb2Vzbid0IGtub3cgYWJvdXQgdGhpcyByZXZpc2lvbiB5ZXRcbiAgICAgICAgICB0aHJvdyBcIlRlbXBsYXRlIHdhcyBwcmVjb21waWxlZCB3aXRoIGEgbmV3ZXIgdmVyc2lvbiBvZiBIYW5kbGViYXJzIHRoYW4gdGhlIGN1cnJlbnQgcnVudGltZS4gXCIrXG4gICAgICAgICAgICAgICAgXCJQbGVhc2UgdXBkYXRlIHlvdXIgcnVudGltZSB0byBhIG5ld2VyIHZlcnNpb24gKFwiK2NvbXBpbGVySW5mb1sxXStcIikuXCI7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9LFxuXG4gIHByb2dyYW1XaXRoRGVwdGg6IGZ1bmN0aW9uKGksIGZuLCBkYXRhIC8qLCAkZGVwdGggKi8pIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMyk7XG5cbiAgICB2YXIgcHJvZ3JhbSA9IGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgW2NvbnRleHQsIG9wdGlvbnMuZGF0YSB8fCBkYXRhXS5jb25jYXQoYXJncykpO1xuICAgIH07XG4gICAgcHJvZ3JhbS5wcm9ncmFtID0gaTtcbiAgICBwcm9ncmFtLmRlcHRoID0gYXJncy5sZW5ndGg7XG4gICAgcmV0dXJuIHByb2dyYW07XG4gIH0sXG4gIHByb2dyYW06IGZ1bmN0aW9uKGksIGZuLCBkYXRhKSB7XG4gICAgdmFyIHByb2dyYW0gPSBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgICAgcmV0dXJuIGZuKGNvbnRleHQsIG9wdGlvbnMuZGF0YSB8fCBkYXRhKTtcbiAgICB9O1xuICAgIHByb2dyYW0ucHJvZ3JhbSA9IGk7XG4gICAgcHJvZ3JhbS5kZXB0aCA9IDA7XG4gICAgcmV0dXJuIHByb2dyYW07XG4gIH0sXG4gIG5vb3A6IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJcIjsgfSxcbiAgaW52b2tlUGFydGlhbDogZnVuY3Rpb24ocGFydGlhbCwgbmFtZSwgY29udGV4dCwgaGVscGVycywgcGFydGlhbHMsIGRhdGEpIHtcbiAgICB2YXIgb3B0aW9ucyA9IHsgaGVscGVyczogaGVscGVycywgcGFydGlhbHM6IHBhcnRpYWxzLCBkYXRhOiBkYXRhIH07XG5cbiAgICBpZihwYXJ0aWFsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBIYW5kbGViYXJzLkV4Y2VwdGlvbihcIlRoZSBwYXJ0aWFsIFwiICsgbmFtZSArIFwiIGNvdWxkIG5vdCBiZSBmb3VuZFwiKTtcbiAgICB9IGVsc2UgaWYocGFydGlhbCBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm4gcGFydGlhbChjb250ZXh0LCBvcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKCFIYW5kbGViYXJzLmNvbXBpbGUpIHtcbiAgICAgIHRocm93IG5ldyBIYW5kbGViYXJzLkV4Y2VwdGlvbihcIlRoZSBwYXJ0aWFsIFwiICsgbmFtZSArIFwiIGNvdWxkIG5vdCBiZSBjb21waWxlZCB3aGVuIHJ1bm5pbmcgaW4gcnVudGltZS1vbmx5IG1vZGVcIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcnRpYWxzW25hbWVdID0gSGFuZGxlYmFycy5jb21waWxlKHBhcnRpYWwsIHtkYXRhOiBkYXRhICE9PSB1bmRlZmluZWR9KTtcbiAgICAgIHJldHVybiBwYXJ0aWFsc1tuYW1lXShjb250ZXh0LCBvcHRpb25zKTtcbiAgICB9XG4gIH1cbn07XG5cbkhhbmRsZWJhcnMudGVtcGxhdGUgPSBIYW5kbGViYXJzLlZNLnRlbXBsYXRlO1xuXG4vLyBFTkQoQlJPV1NFUilcblxucmV0dXJuIEhhbmRsZWJhcnM7XG5cbn07XG4iLCJleHBvcnRzLmF0dGFjaCA9IGZ1bmN0aW9uKEhhbmRsZWJhcnMpIHtcblxudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLy8gQkVHSU4oQlJPV1NFUilcblxudmFyIGVycm9yUHJvcHMgPSBbJ2Rlc2NyaXB0aW9uJywgJ2ZpbGVOYW1lJywgJ2xpbmVOdW1iZXInLCAnbWVzc2FnZScsICduYW1lJywgJ251bWJlcicsICdzdGFjayddO1xuXG5IYW5kbGViYXJzLkV4Y2VwdGlvbiA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgdmFyIHRtcCA9IEVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3Rvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gIC8vIFVuZm9ydHVuYXRlbHkgZXJyb3JzIGFyZSBub3QgZW51bWVyYWJsZSBpbiBDaHJvbWUgKGF0IGxlYXN0KSwgc28gYGZvciBwcm9wIGluIHRtcGAgZG9lc24ndCB3b3JrLlxuICBmb3IgKHZhciBpZHggPSAwOyBpZHggPCBlcnJvclByb3BzLmxlbmd0aDsgaWR4KyspIHtcbiAgICB0aGlzW2Vycm9yUHJvcHNbaWR4XV0gPSB0bXBbZXJyb3JQcm9wc1tpZHhdXTtcbiAgfVxufTtcbkhhbmRsZWJhcnMuRXhjZXB0aW9uLnByb3RvdHlwZSA9IG5ldyBFcnJvcigpO1xuXG4vLyBCdWlsZCBvdXQgb3VyIGJhc2ljIFNhZmVTdHJpbmcgdHlwZVxuSGFuZGxlYmFycy5TYWZlU3RyaW5nID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gIHRoaXMuc3RyaW5nID0gc3RyaW5nO1xufTtcbkhhbmRsZWJhcnMuU2FmZVN0cmluZy5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuc3RyaW5nLnRvU3RyaW5nKCk7XG59O1xuXG52YXIgZXNjYXBlID0ge1xuICBcIiZcIjogXCImYW1wO1wiLFxuICBcIjxcIjogXCImbHQ7XCIsXG4gIFwiPlwiOiBcIiZndDtcIixcbiAgJ1wiJzogXCImcXVvdDtcIixcbiAgXCInXCI6IFwiJiN4Mjc7XCIsXG4gIFwiYFwiOiBcIiYjeDYwO1wiXG59O1xuXG52YXIgYmFkQ2hhcnMgPSAvWyY8PlwiJ2BdL2c7XG52YXIgcG9zc2libGUgPSAvWyY8PlwiJ2BdLztcblxudmFyIGVzY2FwZUNoYXIgPSBmdW5jdGlvbihjaHIpIHtcbiAgcmV0dXJuIGVzY2FwZVtjaHJdIHx8IFwiJmFtcDtcIjtcbn07XG5cbkhhbmRsZWJhcnMuVXRpbHMgPSB7XG4gIGV4dGVuZDogZnVuY3Rpb24ob2JqLCB2YWx1ZSkge1xuICAgIGZvcih2YXIga2V5IGluIHZhbHVlKSB7XG4gICAgICBpZih2YWx1ZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgIG9ialtrZXldID0gdmFsdWVba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgZXNjYXBlRXhwcmVzc2lvbjogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgLy8gZG9uJ3QgZXNjYXBlIFNhZmVTdHJpbmdzLCBzaW5jZSB0aGV5J3JlIGFscmVhZHkgc2FmZVxuICAgIGlmIChzdHJpbmcgaW5zdGFuY2VvZiBIYW5kbGViYXJzLlNhZmVTdHJpbmcpIHtcbiAgICAgIHJldHVybiBzdHJpbmcudG9TdHJpbmcoKTtcbiAgICB9IGVsc2UgaWYgKHN0cmluZyA9PSBudWxsIHx8IHN0cmluZyA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cblxuICAgIC8vIEZvcmNlIGEgc3RyaW5nIGNvbnZlcnNpb24gYXMgdGhpcyB3aWxsIGJlIGRvbmUgYnkgdGhlIGFwcGVuZCByZWdhcmRsZXNzIGFuZFxuICAgIC8vIHRoZSByZWdleCB0ZXN0IHdpbGwgZG8gdGhpcyB0cmFuc3BhcmVudGx5IGJlaGluZCB0aGUgc2NlbmVzLCBjYXVzaW5nIGlzc3VlcyBpZlxuICAgIC8vIGFuIG9iamVjdCdzIHRvIHN0cmluZyBoYXMgZXNjYXBlZCBjaGFyYWN0ZXJzIGluIGl0LlxuICAgIHN0cmluZyA9IHN0cmluZy50b1N0cmluZygpO1xuXG4gICAgaWYoIXBvc3NpYmxlLnRlc3Qoc3RyaW5nKSkgeyByZXR1cm4gc3RyaW5nOyB9XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKGJhZENoYXJzLCBlc2NhcGVDaGFyKTtcbiAgfSxcblxuICBpc0VtcHR5OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIGlmICghdmFsdWUgJiYgdmFsdWUgIT09IDApIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSBpZih0b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIEVORChCUk9XU0VSKVxuXG5yZXR1cm4gSGFuZGxlYmFycztcbn07XG4iLCJ2YXIgVG9rZW5pemVyID0gcmVxdWlyZShcIi4vVG9rZW5pemVyLmpzXCIpO1xuXG4vKlxuXHRPcHRpb25zOlxuXHRcblx0eG1sTW9kZTogU3BlY2lhbCBiZWhhdmlvciBmb3Igc2NyaXB0L3N0eWxlIHRhZ3MgKHRydWUgYnkgZGVmYXVsdClcblx0bG93ZXJDYXNlQXR0cmlidXRlTmFtZXM6IGNhbGwgLnRvTG93ZXJDYXNlIGZvciBlYWNoIGF0dHJpYnV0ZSBuYW1lICh0cnVlIGlmIHhtbE1vZGUgaXMgYGZhbHNlYClcblx0bG93ZXJDYXNlVGFnczogY2FsbCAudG9Mb3dlckNhc2UgZm9yIGVhY2ggdGFnIG5hbWUgKHRydWUgaWYgeG1sTW9kZSBpcyBgZmFsc2VgKVxuKi9cblxuLypcblx0Q2FsbGJhY2tzOlxuXHRcblx0b25jZGF0YWVuZCxcblx0b25jZGF0YXN0YXJ0LFxuXHRvbmNsb3NldGFnLFxuXHRvbmNvbW1lbnQsXG5cdG9uY29tbWVudGVuZCxcblx0b25lcnJvcixcblx0b25vcGVudGFnLFxuXHRvbnByb2Nlc3NpbmdpbnN0cnVjdGlvbixcblx0b25yZXNldCxcblx0b250ZXh0XG4qL1xuXG52YXIgZm9ybVRhZ3MgPSB7XG5cdGlucHV0OiB0cnVlLFxuXHRvcHRpb246IHRydWUsXG5cdG9wdGdyb3VwOiB0cnVlLFxuXHRzZWxlY3Q6IHRydWUsXG5cdGJ1dHRvbjogdHJ1ZSxcblx0ZGF0YWxpc3Q6IHRydWUsXG5cdHRleHRhcmVhOiB0cnVlXG59O1xudmFyIG9wZW5JbXBsaWVzQ2xvc2UgPSB7XG5cdHRyICAgICAgOiB7IHRyOnRydWUsIHRoOnRydWUsIHRkOnRydWUgfSxcblx0dGggICAgICA6IHsgdGg6dHJ1ZSB9LFxuXHR0ZCAgICAgIDogeyB0aGVhZDp0cnVlLCB0ZDp0cnVlIH0sXG5cdGJvZHkgICAgOiB7IGhlYWQ6dHJ1ZSwgbGluazp0cnVlLCBzY3JpcHQ6dHJ1ZSB9LFxuXHRsaSAgICAgIDogeyBsaTp0cnVlIH0sXG5cdHAgICAgICAgOiB7IHA6dHJ1ZSB9LFxuXHRzZWxlY3QgIDogZm9ybVRhZ3MsXG5cdGlucHV0ICAgOiBmb3JtVGFncyxcblx0b3V0cHV0ICA6IGZvcm1UYWdzLFxuXHRidXR0b24gIDogZm9ybVRhZ3MsXG5cdGRhdGFsaXN0OiBmb3JtVGFncyxcblx0dGV4dGFyZWE6IGZvcm1UYWdzLFxuXHRvcHRpb24gIDogeyBvcHRpb246dHJ1ZSB9LFxuXHRvcHRncm91cDogeyBvcHRncm91cDp0cnVlIH1cbn07XG5cbnZhciB2b2lkRWxlbWVudHMgPSB7XG5cdF9fcHJvdG9fXzogbnVsbCxcblx0YXJlYTogdHJ1ZSxcblx0YmFzZTogdHJ1ZSxcblx0YmFzZWZvbnQ6IHRydWUsXG5cdGJyOiB0cnVlLFxuXHRjb2w6IHRydWUsXG5cdGNvbW1hbmQ6IHRydWUsXG5cdGVtYmVkOiB0cnVlLFxuXHRmcmFtZTogdHJ1ZSxcblx0aHI6IHRydWUsXG5cdGltZzogdHJ1ZSxcblx0aW5wdXQ6IHRydWUsXG5cdGlzaW5kZXg6IHRydWUsXG5cdGtleWdlbjogdHJ1ZSxcblx0bGluazogdHJ1ZSxcblx0bWV0YTogdHJ1ZSxcblx0cGFyYW06IHRydWUsXG5cdHNvdXJjZTogdHJ1ZSxcblx0dHJhY2s6IHRydWUsXG5cdHdicjogdHJ1ZVxufTtcblxuZnVuY3Rpb24gUGFyc2VyKGNicywgb3B0aW9ucyl7XG5cdHRoaXMuX29wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXHR0aGlzLl9jYnMgPSBjYnMgfHwge307XG5cblx0dGhpcy5fdGFnbmFtZSA9IFwiXCI7XG5cdHRoaXMuX2F0dHJpYm5hbWUgPSBcIlwiO1xuXHR0aGlzLl9hdHRyaWJzID0gbnVsbDtcblx0dGhpcy5fc3RhY2sgPSBbXTtcblx0dGhpcy5fZG9uZSA9IGZhbHNlO1xuXG5cdHRoaXMuX3Rva2VuaXplciA9IG5ldyBUb2tlbml6ZXIob3B0aW9ucywgdGhpcyk7XG59XG5cbnJlcXVpcmUoXCJ1dGlsXCIpLmluaGVyaXRzKFBhcnNlciwgcmVxdWlyZShcImV2ZW50c1wiKS5FdmVudEVtaXR0ZXIpO1xuXG4vL1Rva2VuaXplciBldmVudCBoYW5kbGVyc1xuUGFyc2VyLnByb3RvdHlwZS5vbnRleHQgPSBmdW5jdGlvbihkYXRhKXtcblx0aWYodGhpcy5fY2JzLm9udGV4dCkgdGhpcy5fY2JzLm9udGV4dChkYXRhKTtcbn07XG5cblBhcnNlci5wcm90b3R5cGUub25vcGVudGFnbmFtZSA9IGZ1bmN0aW9uKG5hbWUpe1xuXHRpZighKHRoaXMuX29wdGlvbnMueG1sTW9kZSB8fCBcImxvd2VyQ2FzZVRhZ3NcIiBpbiB0aGlzLl9vcHRpb25zKSB8fCB0aGlzLl9vcHRpb25zLmxvd2VyQ2FzZVRhZ3Mpe1xuXHRcdG5hbWUgPSBuYW1lLnRvTG93ZXJDYXNlKCk7XG5cdH1cblxuXHR0aGlzLl90YWduYW1lID0gbmFtZTtcblxuXHRpZiAoIXRoaXMuX29wdGlvbnMueG1sTW9kZSAmJiBuYW1lIGluIG9wZW5JbXBsaWVzQ2xvc2UpIHtcblx0XHRmb3IoXG5cdFx0XHR2YXIgZWw7XG5cdFx0XHQoZWwgPSB0aGlzLl9zdGFja1t0aGlzLl9zdGFjay5sZW5ndGgtMV0pIGluIG9wZW5JbXBsaWVzQ2xvc2VbbmFtZV07XG5cdFx0XHR0aGlzLm9uY2xvc2V0YWcoZWwpXG5cdFx0KTtcblx0fVxuXG5cdGlmKHRoaXMuX29wdGlvbnMueG1sTW9kZSB8fCAhKG5hbWUgaW4gdm9pZEVsZW1lbnRzKSl7XG5cdFx0dGhpcy5fc3RhY2sucHVzaChuYW1lKTtcblx0fVxuXG5cdGlmKHRoaXMuX2Nicy5vbm9wZW50YWduYW1lKSB0aGlzLl9jYnMub25vcGVudGFnbmFtZShuYW1lKTtcblx0aWYodGhpcy5fY2JzLm9ub3BlbnRhZykgdGhpcy5fYXR0cmlicyA9IHt9O1xufTtcblxuUGFyc2VyLnByb3RvdHlwZS5vbm9wZW50YWdlbmQgPSBmdW5jdGlvbigpe1xuXHRpZih0aGlzLl9hdHRyaWJuYW1lICE9PSBcIlwiKSB0aGlzLm9uYXR0cmlidmFsdWUoXCJcIik7XG5cdGlmKHRoaXMuX2F0dHJpYnMpe1xuXHRcdGlmKHRoaXMuX2Nicy5vbm9wZW50YWcpIHRoaXMuX2Nicy5vbm9wZW50YWcodGhpcy5fdGFnbmFtZSwgdGhpcy5fYXR0cmlicyk7XG5cdFx0dGhpcy5fYXR0cmlicyA9IG51bGw7XG5cdH1cblx0aWYoIXRoaXMuX29wdGlvbnMueG1sTW9kZSAmJiB0aGlzLl9jYnMub25jbG9zZXRhZyAmJiB0aGlzLl90YWduYW1lIGluIHZvaWRFbGVtZW50cyl7XG5cdFx0dGhpcy5fY2JzLm9uY2xvc2V0YWcodGhpcy5fdGFnbmFtZSk7XG5cdH1cblx0dGhpcy5fdGFnbmFtZSA9IFwiXCI7XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLm9uY2xvc2V0YWcgPSBmdW5jdGlvbihuYW1lKXtcblx0aWYoISh0aGlzLl9vcHRpb25zLnhtbE1vZGUgfHwgXCJsb3dlckNhc2VUYWdzXCIgaW4gdGhpcy5fb3B0aW9ucykgfHwgdGhpcy5fb3B0aW9ucy5sb3dlckNhc2VUYWdzKXtcblx0XHRuYW1lID0gbmFtZS50b0xvd2VyQ2FzZSgpO1xuXHR9XG5cdGlmKHRoaXMuX3N0YWNrLmxlbmd0aCAmJiAoIShuYW1lIGluIHZvaWRFbGVtZW50cykgfHwgdGhpcy5fb3B0aW9ucy54bWxNb2RlKSl7XG5cdFx0dmFyIHBvcyA9IHRoaXMuX3N0YWNrLmxhc3RJbmRleE9mKG5hbWUpO1xuXHRcdGlmKHBvcyAhPT0gLTEpe1xuXHRcdFx0aWYodGhpcy5fY2JzLm9uY2xvc2V0YWcpe1xuXHRcdFx0XHRwb3MgPSB0aGlzLl9zdGFjay5sZW5ndGggLSBwb3M7XG5cdFx0XHRcdHdoaWxlKHBvcy0tKSB0aGlzLl9jYnMub25jbG9zZXRhZyh0aGlzLl9zdGFjay5wb3AoKSk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHRoaXMuX3N0YWNrLnNwbGljZShwb3MpO1xuXHRcdH0gZWxzZSBpZihuYW1lID09PSBcInBcIiAmJiAhdGhpcy5fb3B0aW9ucy54bWxNb2RlKXtcblx0XHRcdHRoaXMub25vcGVudGFnbmFtZShuYW1lKTtcblx0XHRcdHRoaXMub25zZWxmY2xvc2luZ3RhZygpO1xuXHRcdH1cblx0fSBlbHNlIGlmKCF0aGlzLl9vcHRpb25zLnhtbE1vZGUgJiYgKG5hbWUgPT09IFwiYnJcIiB8fCBuYW1lID09PSBcInBcIikpe1xuXHRcdHRoaXMub25vcGVudGFnbmFtZShuYW1lKTtcblx0XHR0aGlzLm9uc2VsZmNsb3Npbmd0YWcoKTtcdFx0XG5cdH1cbn07XG5cblBhcnNlci5wcm90b3R5cGUub25zZWxmY2xvc2luZ3RhZyA9IGZ1bmN0aW9uKCl7XG5cdHZhciBuYW1lID0gdGhpcy5fdGFnbmFtZTtcblxuXHR0aGlzLm9ub3BlbnRhZ2VuZCgpO1xuXG5cdC8vc2VsZi1jbG9zaW5nIHRhZ3Mgd2lsbCBiZSBvbiB0aGUgdG9wIG9mIHRoZSBzdGFja1xuXHQvLyhjaGVhcGVyIGNoZWNrIHRoYW4gaW4gb25jbG9zZXRhZylcblx0aWYodGhpcy5fc3RhY2tbdGhpcy5fc3RhY2subGVuZ3RoLTFdID09PSBuYW1lKXtcblx0XHRpZih0aGlzLl9jYnMub25jbG9zZXRhZyl7XG5cdFx0XHR0aGlzLl9jYnMub25jbG9zZXRhZyhuYW1lKTtcblx0XHR9XG5cdFx0dGhpcy5fc3RhY2sucG9wKCk7XG5cdH1cbn07XG5cblBhcnNlci5wcm90b3R5cGUub25hdHRyaWJuYW1lID0gZnVuY3Rpb24obmFtZSl7XG5cdGlmKHRoaXMuX2F0dHJpYm5hbWUgIT09IFwiXCIpIHRoaXMub25hdHRyaWJ2YWx1ZShcIlwiKTtcblx0aWYoISh0aGlzLl9vcHRpb25zLnhtbE1vZGUgfHwgXCJsb3dlckNhc2VBdHRyaWJ1dGVOYW1lc1wiIGluIHRoaXMuX29wdGlvbnMpIHx8IHRoaXMuX29wdGlvbnMubG93ZXJDYXNlQXR0cmlidXRlTmFtZXMpe1xuXHRcdG5hbWUgPSBuYW1lLnRvTG93ZXJDYXNlKCk7XG5cdH1cblx0dGhpcy5fYXR0cmlibmFtZSA9IG5hbWU7XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLm9uYXR0cmlidmFsdWUgPSBmdW5jdGlvbiBhdHRyaWJWYWx1ZSh2YWx1ZSl7XG5cdGlmKHRoaXMuX2Nicy5vbmF0dHJpYnV0ZSkgdGhpcy5fY2JzLm9uYXR0cmlidXRlKHRoaXMuX2F0dHJpYm5hbWUsIHZhbHVlKTtcblx0aWYoXG5cdFx0dGhpcy5fYXR0cmlicyAmJlxuXHRcdCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodGhpcy5fYXR0cmlicywgdGhpcy5fYXR0cmlibmFtZSlcblx0KXtcblx0XHR0aGlzLl9hdHRyaWJzW3RoaXMuX2F0dHJpYm5hbWVdID0gdmFsdWU7XG5cdH1cblx0dGhpcy5fYXR0cmlibmFtZSA9IFwiXCI7XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLm9uZGVjbGFyYXRpb24gPSBmdW5jdGlvbih2YWx1ZSl7XG5cdGlmKHRoaXMuX2Nicy5vbnByb2Nlc3NpbmdpbnN0cnVjdGlvbil7XG5cdFx0dmFyIG5hbWUgPSB2YWx1ZS5zcGxpdCgvXFxzfFxcLy8sIDEpWzBdO1xuXHRcdGlmKCEodGhpcy5fb3B0aW9ucy54bWxNb2RlIHx8IFwibG93ZXJDYXNlVGFnc1wiIGluIHRoaXMuX29wdGlvbnMpIHx8IHRoaXMuX29wdGlvbnMubG93ZXJDYXNlVGFncyl7XG5cdFx0XHRuYW1lID0gbmFtZS50b0xvd2VyQ2FzZSgpO1xuXHRcdH1cblx0XHR0aGlzLl9jYnMub25wcm9jZXNzaW5naW5zdHJ1Y3Rpb24oXCIhXCIgKyBuYW1lLCBcIiFcIiArIHZhbHVlKTtcblx0fVxufTtcblxuUGFyc2VyLnByb3RvdHlwZS5vbnByb2Nlc3NpbmdpbnN0cnVjdGlvbiA9IGZ1bmN0aW9uKHZhbHVlKXtcblx0aWYodGhpcy5fY2JzLm9ucHJvY2Vzc2luZ2luc3RydWN0aW9uKXtcblx0XHR2YXIgbmFtZSA9IHZhbHVlLnNwbGl0KC9cXHN8XFwvLywgMSlbMF07XG5cdFx0aWYoISh0aGlzLl9vcHRpb25zLnhtbE1vZGUgfHwgXCJsb3dlckNhc2VUYWdzXCIgaW4gdGhpcy5fb3B0aW9ucykgfHwgdGhpcy5fb3B0aW9ucy5sb3dlckNhc2VUYWdzKXtcblx0XHRcdG5hbWUgPSBuYW1lLnRvTG93ZXJDYXNlKCk7XG5cdFx0fVxuXHRcdHRoaXMuX2Nicy5vbnByb2Nlc3NpbmdpbnN0cnVjdGlvbihcIj9cIiArIG5hbWUsIFwiP1wiICsgdmFsdWUpO1xuXHR9XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLm9uY29tbWVudCA9IGZ1bmN0aW9uKHZhbHVlKXtcblx0aWYodGhpcy5fY2JzLm9uY29tbWVudCkgdGhpcy5fY2JzLm9uY29tbWVudCh2YWx1ZSk7XG5cdGlmKHRoaXMuX2Nicy5vbmNvbW1lbnRlbmQpIHRoaXMuX2Nicy5vbmNvbW1lbnRlbmQoKTtcbn07XG5cblBhcnNlci5wcm90b3R5cGUub25jZGF0YSA9IGZ1bmN0aW9uKHZhbHVlKXtcblx0aWYodGhpcy5fb3B0aW9ucy54bWxNb2RlKXtcblx0XHRpZih0aGlzLl9jYnMub25jZGF0YXN0YXJ0KSB0aGlzLl9jYnMub25jZGF0YXN0YXJ0KCk7XG5cdFx0aWYodGhpcy5fY2JzLm9udGV4dCkgdGhpcy5fY2JzLm9udGV4dCh2YWx1ZSk7XG5cdFx0aWYodGhpcy5fY2JzLm9uY2RhdGFlbmQpIHRoaXMuX2Nicy5vbmNkYXRhZW5kKCk7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5vbmNvbW1lbnQoXCJbQ0RBVEFbXCIgKyB2YWx1ZSArIFwiXV1cIik7XG5cdH1cbn07XG5cblBhcnNlci5wcm90b3R5cGUub25lcnJvciA9IGZ1bmN0aW9uKGVycil7XG5cdGlmKHRoaXMuX2Nicy5vbmVycm9yKSB0aGlzLl9jYnMub25lcnJvcihlcnIpO1xufTtcblxuUGFyc2VyLnByb3RvdHlwZS5vbmVuZCA9IGZ1bmN0aW9uKCl7XG5cdGlmKHRoaXMuX2Nicy5vbmNsb3NldGFnKXtcblx0XHRmb3IoXG5cdFx0XHR2YXIgaSA9IHRoaXMuX3N0YWNrLmxlbmd0aDtcblx0XHRcdGkgPiAwO1xuXHRcdFx0dGhpcy5fY2JzLm9uY2xvc2V0YWcodGhpcy5fc3RhY2tbLS1pXSlcblx0XHQpO1xuXHR9XG5cdGlmKHRoaXMuX2Nicy5vbmVuZCkgdGhpcy5fY2JzLm9uZW5kKCk7XG59O1xuXG5cbi8vUmVzZXRzIHRoZSBwYXJzZXIgdG8gYSBibGFuayBzdGF0ZSwgcmVhZHkgdG8gcGFyc2UgYSBuZXcgSFRNTCBkb2N1bWVudFxuUGFyc2VyLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCl7XG5cdGlmKHRoaXMuX2Nicy5vbnJlc2V0KSB0aGlzLl9jYnMub25yZXNldCgpO1xuXHR0aGlzLl90b2tlbml6ZXIucmVzZXQoKTtcblxuXHR0aGlzLl90YWduYW1lID0gXCJcIjtcblx0dGhpcy5fYXR0cmlibmFtZSA9IFwiXCI7XG5cdHRoaXMuX2F0dHJpYnMgPSBudWxsO1xuXHR0aGlzLl9zdGFjayA9IFtdO1xuXHR0aGlzLl9kb25lID0gZmFsc2U7XG59O1xuXG4vL1BhcnNlcyBhIGNvbXBsZXRlIEhUTUwgZG9jdW1lbnQgYW5kIHB1c2hlcyBpdCB0byB0aGUgaGFuZGxlclxuUGFyc2VyLnByb3RvdHlwZS5wYXJzZUNvbXBsZXRlID0gZnVuY3Rpb24oZGF0YSl7XG5cdHRoaXMucmVzZXQoKTtcblx0dGhpcy5lbmQoZGF0YSk7XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24oY2h1bmspe1xuXHRpZih0aGlzLl9kb25lKSB0aGlzLm9uZXJyb3IoRXJyb3IoXCIud3JpdGUoKSBhZnRlciBkb25lIVwiKSk7XG5cdHRoaXMuX3Rva2VuaXplci53cml0ZShjaHVuayk7XG59O1xuXG5QYXJzZXIucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uKGNodW5rKXtcblx0aWYodGhpcy5fZG9uZSkgdGhpcy5vbmVycm9yKEVycm9yKFwiLmVuZCgpIGFmdGVyIGRvbmUhXCIpKTtcblx0dGhpcy5fdG9rZW5pemVyLmVuZChjaHVuayk7XG5cdHRoaXMuX2RvbmUgPSB0cnVlO1xufTtcblxuLy9hbGlhcyBmb3IgYmFja3dhcmRzIGNvbXBhdFxuUGFyc2VyLnByb3RvdHlwZS5wYXJzZUNodW5rID0gUGFyc2VyLnByb3RvdHlwZS53cml0ZTtcblBhcnNlci5wcm90b3R5cGUuZG9uZSA9IFBhcnNlci5wcm90b3R5cGUuZW5kO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnNlcjtcbiIsIm1vZHVsZS5leHBvcnRzID0gVG9rZW5pemVyO1xuXG52YXIgaSA9IDAsXG5cbiAgICBURVhUID0gaSsrLFxuICAgIEJFRk9SRV9UQUdfTkFNRSA9IGkrKywgLy9hZnRlciA8XG4gICAgSU5fVEFHX05BTUUgPSBpKyssXG4gICAgQkVGT1JFX0NMT1NJTkdfVEFHX05BTUUgPSBpKyssXG4gICAgSU5fQ0xPU0lOR19UQUdfTkFNRSA9IGkrKyxcbiAgICBBRlRFUl9DTE9TSU5HX1RBR19OQU1FID0gaSsrLFxuXG4gICAgLy9hdHRyaWJ1dGVzXG4gICAgQkVGT1JFX0FUVFJJQlVURV9OQU1FID0gaSsrLFxuICAgIElOX0FUVFJJQlVURV9OQU1FID0gaSsrLFxuICAgIEFGVEVSX0FUVFJJQlVURV9OQU1FID0gaSsrLFxuICAgIEJFRk9SRV9BVFRSSUJVVEVfVkFMVUUgPSBpKyssXG4gICAgSU5fQVRUUklCVVRFX1ZBTFVFX0RPVUJMRV9RVU9URVMgPSBpKyssIC8vIFwiXG4gICAgSU5fQVRUUklCVVRFX1ZBTFVFX1NJTkdMRV9RVU9URVMgPSBpKyssIC8vICdcbiAgICBJTl9BVFRSSUJVVEVfVkFMVUVfTk9fUVVPVEVTID0gaSsrLFxuXG4gICAgLy9kZWNsYXJhdGlvbnNcbiAgICBCRUZPUkVfREVDTEFSQVRJT04gPSBpKyssIC8vICFcbiAgICBJTl9ERUNMQVJBVElPTiA9IGkrKyxcblxuICAgIC8vcHJvY2Vzc2luZyBpbnN0cnVjdGlvbnNcbiAgICBJTl9QUk9DRVNTSU5HX0lOU1RSVUNUSU9OID0gaSsrLCAvLyA/XG5cbiAgICAvL2NvbW1lbnRzXG4gICAgQkVGT1JFX0NPTU1FTlQgPSBpKyssXG4gICAgSU5fQ09NTUVOVCA9IGkrKyxcbiAgICBBRlRFUl9DT01NRU5UXzEgPSBpKyssXG4gICAgQUZURVJfQ09NTUVOVF8yID0gaSsrLFxuXG4gICAgLy9jZGF0YVxuICAgIEJFRk9SRV9DREFUQV8xID0gaSsrLCAvLyBbXG4gICAgQkVGT1JFX0NEQVRBXzIgPSBpKyssIC8vIENcbiAgICBCRUZPUkVfQ0RBVEFfMyA9IGkrKywgLy8gRFxuICAgIEJFRk9SRV9DREFUQV80ID0gaSsrLCAvLyBBXG4gICAgQkVGT1JFX0NEQVRBXzUgPSBpKyssIC8vIFRcbiAgICBCRUZPUkVfQ0RBVEFfNiA9IGkrKywgLy8gQVxuICAgIElOX0NEQVRBID0gaSsrLC8vIFtcbiAgICBBRlRFUl9DREFUQV8xID0gaSsrLCAvLyBdXG4gICAgQUZURVJfQ0RBVEFfMiA9IGkrKywgLy8gXVxuXG4gICAgLy9zcGVjaWFsIHRhZ3NcbiAgICBCRUZPUkVfU1BFQ0lBTCA9IGkrKywgLy9TXG4gICAgQkVGT1JFX1NQRUNJQUxfRU5EID0gaSsrLCAgIC8vU1xuXG4gICAgQkVGT1JFX1NDUklQVF8xID0gaSsrLCAvL0NcbiAgICBCRUZPUkVfU0NSSVBUXzIgPSBpKyssIC8vUlxuICAgIEJFRk9SRV9TQ1JJUFRfMyA9IGkrKywgLy9JXG4gICAgQkVGT1JFX1NDUklQVF80ID0gaSsrLCAvL1BcbiAgICBCRUZPUkVfU0NSSVBUXzUgPSBpKyssIC8vVFxuICAgIEFGVEVSX1NDUklQVF8xID0gaSsrLCAvL0NcbiAgICBBRlRFUl9TQ1JJUFRfMiA9IGkrKywgLy9SXG4gICAgQUZURVJfU0NSSVBUXzMgPSBpKyssIC8vSVxuICAgIEFGVEVSX1NDUklQVF80ID0gaSsrLCAvL1BcbiAgICBBRlRFUl9TQ1JJUFRfNSA9IGkrKywgLy9UXG5cbiAgICBCRUZPUkVfU1RZTEVfMSA9IGkrKywgLy9UXG4gICAgQkVGT1JFX1NUWUxFXzIgPSBpKyssIC8vWVxuICAgIEJFRk9SRV9TVFlMRV8zID0gaSsrLCAvL0xcbiAgICBCRUZPUkVfU1RZTEVfNCA9IGkrKywgLy9FXG4gICAgQUZURVJfU1RZTEVfMSA9IGkrKywgLy9UXG4gICAgQUZURVJfU1RZTEVfMiA9IGkrKywgLy9ZXG4gICAgQUZURVJfU1RZTEVfMyA9IGkrKywgLy9MXG4gICAgQUZURVJfU1RZTEVfNCA9IGkrKywgLy9FXG5cbiAgICBTUEVDSUFMX05PTkUgPSAwLFxuICAgIFNQRUNJQUxfU0NSSVBUID0gMSxcbiAgICBTUEVDSUFMX1NUWUxFID0gMjtcblxuXG5mdW5jdGlvbiB3aGl0ZXNwYWNlKGMpe1xuXHRyZXR1cm4gYyA9PT0gXCIgXCIgfHwgYyA9PT0gXCJcXG5cIiB8fCBjID09PSBcIlxcdFwiIHx8IGMgPT09IFwiXFxmXCI7XG59XG5cbmZ1bmN0aW9uIGlmRWxzZVN0YXRlKHVwcGVyLCBTVUNDRVNTLCBGQUlMVVJFKXtcblx0dmFyIGxvd2VyID0gdXBwZXIudG9Mb3dlckNhc2UoKTtcblxuXHRpZih1cHBlciA9PT0gbG93ZXIpe1xuXHRcdHJldHVybiBmdW5jdGlvbihjKXtcblx0XHRcdHRoaXMuX3N0YXRlID0gYyA9PT0gbG93ZXIgPyBTVUNDRVNTIDogRkFJTFVSRTtcblx0XHR9O1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBmdW5jdGlvbihjKXtcblx0XHRcdHRoaXMuX3N0YXRlID0gKGMgPT09IGxvd2VyIHx8IGMgPT09IHVwcGVyKSA/IFNVQ0NFU1MgOiBGQUlMVVJFO1xuXHRcdH07XG5cdH1cbn1cblxuZnVuY3Rpb24gY29uc3VtZVNwZWNpYWxOYW1lQ2hhcih1cHBlciwgTkVYVF9TVEFURSl7XG5cdHZhciBsb3dlciA9IHVwcGVyLnRvTG93ZXJDYXNlKCk7XG5cblx0cmV0dXJuIGZ1bmN0aW9uKGMpe1xuXHRcdGlmKGMgPT09IGxvd2VyIHx8IGMgPT09IHVwcGVyKXtcblx0XHRcdHRoaXMuX3N0YXRlID0gTkVYVF9TVEFURTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc3RhdGUgPSBJTl9UQUdfTkFNRTtcblx0XHRcdHRoaXMuX2luZGV4LS07IC8vY29uc3VtZSB0aGUgdG9rZW4gYWdhaW5cblx0XHR9XG5cdH07XG59XG5cbmZ1bmN0aW9uIFRva2VuaXplcihvcHRpb25zLCBjYnMpe1xuXHR0aGlzLl9zdGF0ZSA9IFRFWFQ7XG5cdHRoaXMuX2J1ZmZlciA9IFwiXCI7XG5cdHRoaXMuX3NlY3Rpb25TdGFydCA9IDA7XG5cdHRoaXMuX2luZGV4ID0gMDtcblx0dGhpcy5fc3BlY2lhbCA9IFNQRUNJQUxfTk9ORTtcblx0dGhpcy5fY2JzID0gY2JzO1xuXHR0aGlzLl9ydW5uaW5nID0gdHJ1ZTtcblx0dGhpcy5feG1sTW9kZSA9ICEhKG9wdGlvbnMgJiYgb3B0aW9ucy54bWxNb2RlKTtcbn1cblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVUZXh0ID0gZnVuY3Rpb24gKGMpIHtcblx0aWYoYyA9PT0gXCI8XCIpe1xuXHRcdGlmKHRoaXMuX2luZGV4ID4gdGhpcy5fc2VjdGlvblN0YXJ0KXtcblx0XHRcdHRoaXMuX2Nicy5vbnRleHQodGhpcy5fZ2V0U2VjdGlvbigpKTtcblx0XHR9XG5cdFx0dGhpcy5fc3RhdGUgPSBCRUZPUkVfVEFHX05BTUU7XG5cdFx0dGhpcy5fc2VjdGlvblN0YXJ0ID0gdGhpcy5faW5kZXg7XG5cdH1cbn07XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQmVmb3JlVGFnTmFtZSA9IGZ1bmN0aW9uIChjKSB7XG5cdGlmKGMgPT09IFwiL1wiKXtcblx0XHR0aGlzLl9zdGF0ZSA9IEJFRk9SRV9DTE9TSU5HX1RBR19OQU1FO1xuXHR9IGVsc2UgaWYoYyA9PT0gXCI+XCIgfHwgdGhpcy5fc3BlY2lhbCAhPT0gU1BFQ0lBTF9OT05FIHx8IHdoaXRlc3BhY2UoYykpIHtcblx0XHR0aGlzLl9zdGF0ZSA9IFRFWFQ7XG5cdH0gZWxzZSBpZihjID09PSBcIiFcIil7XG5cdFx0dGhpcy5fc3RhdGUgPSBCRUZPUkVfREVDTEFSQVRJT047XG5cdFx0dGhpcy5fc2VjdGlvblN0YXJ0ID0gdGhpcy5faW5kZXggKyAxO1xuXHR9IGVsc2UgaWYoYyA9PT0gXCI/XCIpe1xuXHRcdHRoaXMuX3N0YXRlID0gSU5fUFJPQ0VTU0lOR19JTlNUUlVDVElPTjtcblx0XHR0aGlzLl9zZWN0aW9uU3RhcnQgPSB0aGlzLl9pbmRleCArIDE7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5fc3RhdGUgPSAoIXRoaXMuX3htbE1vZGUgJiYgKGMgPT09IFwic1wiIHx8IGMgPT09IFwiU1wiKSkgP1xuXHRcdFx0XHRcdFx0QkVGT1JFX1NQRUNJQUwgOiBJTl9UQUdfTkFNRTtcblx0XHR0aGlzLl9zZWN0aW9uU3RhcnQgPSB0aGlzLl9pbmRleDtcblx0fVxufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVJblRhZ05hbWUgPSBmdW5jdGlvbiAoYykge1xuXHRpZihjID09PSBcIi9cIiB8fCBjID09PSBcIj5cIiB8fCB3aGl0ZXNwYWNlKGMpKXtcblx0XHR0aGlzLl9lbWl0VG9rZW4oXCJvbm9wZW50YWduYW1lXCIpO1xuXHRcdHRoaXMuX3N0YXRlID0gQkVGT1JFX0FUVFJJQlVURV9OQU1FO1xuXHRcdHRoaXMuX2luZGV4LS07XG5cdH1cbn07XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQmVmb3JlQ2xvc2VpbmdUYWdOYW1lID0gZnVuY3Rpb24gKGMpIHtcblx0aWYod2hpdGVzcGFjZShjKSk7XG5cdGVsc2UgaWYoYyA9PT0gXCI+XCIpe1xuXHRcdHRoaXMuX3N0YXRlID0gVEVYVDtcblx0fSBlbHNlIGlmKHRoaXMuX3NwZWNpYWwgIT09IFNQRUNJQUxfTk9ORSl7XG5cdFx0aWYoYyA9PT0gXCJzXCIgfHwgYyA9PT0gXCJTXCIpe1xuXHRcdFx0dGhpcy5fc3RhdGUgPSBCRUZPUkVfU1BFQ0lBTF9FTkQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3N0YXRlID0gVEVYVDtcblx0XHRcdHRoaXMuX2luZGV4LS07XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHRoaXMuX3N0YXRlID0gSU5fQ0xPU0lOR19UQUdfTkFNRTtcblx0XHR0aGlzLl9zZWN0aW9uU3RhcnQgPSB0aGlzLl9pbmRleDtcblx0fVxufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVJbkNsb3NlaW5nVGFnTmFtZSA9IGZ1bmN0aW9uIChjKSB7XG5cdGlmKGMgPT09IFwiPlwiIHx8IHdoaXRlc3BhY2UoYykpe1xuXHRcdHRoaXMuX2VtaXRUb2tlbihcIm9uY2xvc2V0YWdcIik7XG5cdFx0dGhpcy5fc3RhdGUgPSBBRlRFUl9DTE9TSU5HX1RBR19OQU1FO1xuXHRcdHRoaXMuX3NwZWNpYWwgPSBTUEVDSUFMX05PTkU7XG5cdFx0dGhpcy5faW5kZXgtLTtcblx0fVxufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVBZnRlckNsb3NlaW5nVGFnTmFtZSA9IGZ1bmN0aW9uIChjKSB7XG5cdC8vc2tpcCBldmVyeXRoaW5nIHVudGlsIFwiPlwiXG5cdGlmKGMgPT09IFwiPlwiKXtcblx0XHR0aGlzLl9zdGF0ZSA9IFRFWFQ7XG5cdFx0dGhpcy5fc2VjdGlvblN0YXJ0ID0gdGhpcy5faW5kZXggKyAxO1xuXHR9XG59O1xuXG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUJlZm9yZUF0dHJpYnV0ZU5hbWUgPSBmdW5jdGlvbiAoYykge1xuXHRpZih3aGl0ZXNwYWNlKGMpKXtcblx0XHQvKiBub29wICovXG5cdH0gZWxzZSBpZihjID09PSBcIj5cIil7XG5cdFx0dGhpcy5fc3RhdGUgPSBURVhUO1xuXHRcdHRoaXMuX2Nicy5vbm9wZW50YWdlbmQoKTtcblx0XHR0aGlzLl9zZWN0aW9uU3RhcnQgPSB0aGlzLl9pbmRleCArIDE7XG5cdH0gZWxzZSBpZihjID09PSBcIi9cIil7XG5cdFx0dGhpcy5fY2JzLm9uc2VsZmNsb3Npbmd0YWcoKTtcblx0XHR0aGlzLl9zdGF0ZSA9IEFGVEVSX0NMT1NJTkdfVEFHX05BTUU7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5fc3RhdGUgPSBJTl9BVFRSSUJVVEVfTkFNRTtcblx0XHR0aGlzLl9zZWN0aW9uU3RhcnQgPSB0aGlzLl9pbmRleDtcblx0fVxufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVJbkF0dHJpYnV0ZU5hbWUgPSBmdW5jdGlvbiAoYykge1xuXHRpZihjID09PSBcIj1cIiB8fCBjID09PSBcIi9cIiB8fCBjID09PSBcIj5cIiB8fCB3aGl0ZXNwYWNlKGMpKXtcblx0XHRpZih0aGlzLl9pbmRleCA+IHRoaXMuX3NlY3Rpb25TdGFydCl7XG5cdFx0XHR0aGlzLl9jYnMub25hdHRyaWJuYW1lKHRoaXMuX2dldFNlY3Rpb24oKSk7XG5cdFx0fVxuXHRcdHRoaXMuX3NlY3Rpb25TdGFydCA9IC0xO1xuXHRcdHRoaXMuX3N0YXRlID0gQUZURVJfQVRUUklCVVRFX05BTUU7XG5cdFx0dGhpcy5faW5kZXgtLTtcblx0fVxufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVBZnRlckF0dHJpYnV0ZU5hbWUgPSBmdW5jdGlvbiAoYykge1xuXHRpZihjID09PSBcIj1cIil7XG5cdFx0dGhpcy5fc3RhdGUgPSBCRUZPUkVfQVRUUklCVVRFX1ZBTFVFO1xuXHR9IGVsc2UgaWYoYyA9PT0gXCIvXCIgfHwgYyA9PT0gXCI+XCIpe1xuXHRcdHRoaXMuX3N0YXRlID0gQkVGT1JFX0FUVFJJQlVURV9OQU1FO1xuXHRcdHRoaXMuX2luZGV4LS07XG5cdH0gZWxzZSBpZighd2hpdGVzcGFjZShjKSl7XG5cdFx0dGhpcy5fc3RhdGUgPSBJTl9BVFRSSUJVVEVfTkFNRTtcblx0XHR0aGlzLl9zZWN0aW9uU3RhcnQgPSB0aGlzLl9pbmRleDtcblx0fVxufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVCZWZvcmVBdHRyaWJ1dGVWYWx1ZSA9IGZ1bmN0aW9uIChjKSB7XG5cdGlmKGMgPT09IFwiXFxcIlwiKXtcblx0XHR0aGlzLl9zdGF0ZSA9IElOX0FUVFJJQlVURV9WQUxVRV9ET1VCTEVfUVVPVEVTO1xuXHRcdHRoaXMuX3NlY3Rpb25TdGFydCA9IHRoaXMuX2luZGV4ICsgMTtcblx0fSBlbHNlIGlmKGMgPT09IFwiJ1wiKXtcblx0XHR0aGlzLl9zdGF0ZSA9IElOX0FUVFJJQlVURV9WQUxVRV9TSU5HTEVfUVVPVEVTO1xuXHRcdHRoaXMuX3NlY3Rpb25TdGFydCA9IHRoaXMuX2luZGV4ICsgMTtcblx0fSBlbHNlIGlmKCF3aGl0ZXNwYWNlKGMpKXtcblx0XHR0aGlzLl9zdGF0ZSA9IElOX0FUVFJJQlVURV9WQUxVRV9OT19RVU9URVM7XG5cdFx0dGhpcy5fc2VjdGlvblN0YXJ0ID0gdGhpcy5faW5kZXg7XG5cdH1cbn07XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlSW5BdHRyaWJ1dGVWYWx1ZURvdWJsZVF1b3RlcyA9IGZ1bmN0aW9uIChjKSB7XG5cdGlmKGMgPT09IFwiXFxcIlwiKXtcblx0XHR0aGlzLl9lbWl0VG9rZW4oXCJvbmF0dHJpYnZhbHVlXCIpO1xuXHRcdHRoaXMuX3N0YXRlID0gQkVGT1JFX0FUVFJJQlVURV9OQU1FO1xuXHR9XG59O1xuXG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUluQXR0cmlidXRlVmFsdWVTaW5nbGVRdW90ZXMgPSBmdW5jdGlvbiAoYykge1xuXHRpZihjID09PSBcIidcIil7XG5cdFx0dGhpcy5fZW1pdFRva2VuKFwib25hdHRyaWJ2YWx1ZVwiKTtcblx0XHR0aGlzLl9zdGF0ZSA9IEJFRk9SRV9BVFRSSUJVVEVfTkFNRTtcblx0fVxufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVJbkF0dHJpYnV0ZVZhbHVlTm9RdW90ZXMgPSBmdW5jdGlvbiAoYykge1xuXHRpZih3aGl0ZXNwYWNlKGMpIHx8IGMgPT09IFwiPlwiKXtcblx0XHR0aGlzLl9lbWl0VG9rZW4oXCJvbmF0dHJpYnZhbHVlXCIpO1xuXHRcdHRoaXMuX3N0YXRlID0gQkVGT1JFX0FUVFJJQlVURV9OQU1FO1xuXHRcdHRoaXMuX2luZGV4LS07XG5cdH1cbn07XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQmVmb3JlRGVjbGFyYXRpb24gPSBmdW5jdGlvbiAoYykge1xuXHR0aGlzLl9zdGF0ZSA9IGMgPT09IFwiW1wiID8gQkVGT1JFX0NEQVRBXzEgOlxuXHRcdFx0XHRcdGMgPT09IFwiLVwiID8gQkVGT1JFX0NPTU1FTlQgOlxuXHRcdFx0XHRcdFx0SU5fREVDTEFSQVRJT047XG59O1xuXG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUluRGVjbGFyYXRpb24gPSBmdW5jdGlvbiAoYykge1xuXHRpZihjID09PSBcIj5cIil7XG5cdFx0dGhpcy5fY2JzLm9uZGVjbGFyYXRpb24odGhpcy5fZ2V0U2VjdGlvbigpKTtcblx0XHR0aGlzLl9zdGF0ZSA9IFRFWFQ7XG5cdFx0dGhpcy5fc2VjdGlvblN0YXJ0ID0gdGhpcy5faW5kZXggKyAxO1xuXHR9XG59O1xuXG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUluUHJvY2Vzc2luZ0luc3RydWN0aW9uID0gZnVuY3Rpb24gKGMpIHtcblx0aWYoYyA9PT0gXCI+XCIpe1xuXHRcdHRoaXMuX2Nicy5vbnByb2Nlc3NpbmdpbnN0cnVjdGlvbih0aGlzLl9nZXRTZWN0aW9uKCkpO1xuXHRcdHRoaXMuX3N0YXRlID0gVEVYVDtcblx0XHR0aGlzLl9zZWN0aW9uU3RhcnQgPSB0aGlzLl9pbmRleCArIDE7XG5cdH1cbn07XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQmVmb3JlQ29tbWVudCA9IGZ1bmN0aW9uIChjKSB7XG5cdGlmKGMgPT09IFwiLVwiKXtcblx0XHR0aGlzLl9zdGF0ZSA9IElOX0NPTU1FTlQ7XG5cdFx0dGhpcy5fc2VjdGlvblN0YXJ0ID0gdGhpcy5faW5kZXggKyAxO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMuX3N0YXRlID0gSU5fREVDTEFSQVRJT047XG5cdH1cbn07XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlSW5Db21tZW50ID0gZnVuY3Rpb24gKGMpIHtcblx0aWYoYyA9PT0gXCItXCIpIHRoaXMuX3N0YXRlID0gQUZURVJfQ09NTUVOVF8xO1xufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVBZnRlckNvbW1lbnQxID0gaWZFbHNlU3RhdGUoXCItXCIsIEFGVEVSX0NPTU1FTlRfMiwgSU5fQ09NTUVOVCk7XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQWZ0ZXJDb21tZW50MiA9IGZ1bmN0aW9uIChjKSB7XG5cdGlmKGMgPT09IFwiPlwiKXtcblx0XHQvL3JlbW92ZSAyIHRyYWlsaW5nIGNoYXJzXG5cdFx0dGhpcy5fY2JzLm9uY29tbWVudCh0aGlzLl9idWZmZXIuc3Vic3RyaW5nKHRoaXMuX3NlY3Rpb25TdGFydCwgdGhpcy5faW5kZXggLSAyKSk7XG5cdFx0dGhpcy5fc3RhdGUgPSBURVhUO1xuXHRcdHRoaXMuX3NlY3Rpb25TdGFydCA9IHRoaXMuX2luZGV4ICsgMTtcblx0fSBlbHNlIGlmIChjICE9PSBcIi1cIikge1xuXHRcdHRoaXMuX3N0YXRlID0gSU5fQ09NTUVOVDtcblx0fVxuXHQvLyBlbHNlOiBzdGF5IGluIEFGVEVSX0NPTU1FTlRfMiAoYC0tLT5gKVxufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVCZWZvcmVDZGF0YTEgPSBpZkVsc2VTdGF0ZShcIkNcIiwgQkVGT1JFX0NEQVRBXzIsIElOX0RFQ0xBUkFUSU9OKTtcblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQmVmb3JlQ2RhdGEyID0gaWZFbHNlU3RhdGUoXCJEXCIsIEJFRk9SRV9DREFUQV8zLCBJTl9ERUNMQVJBVElPTik7XG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUJlZm9yZUNkYXRhMyA9IGlmRWxzZVN0YXRlKFwiQVwiLCBCRUZPUkVfQ0RBVEFfNCwgSU5fREVDTEFSQVRJT04pO1xuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVCZWZvcmVDZGF0YTQgPSBpZkVsc2VTdGF0ZShcIlRcIiwgQkVGT1JFX0NEQVRBXzUsIElOX0RFQ0xBUkFUSU9OKTtcblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQmVmb3JlQ2RhdGE1ID0gaWZFbHNlU3RhdGUoXCJBXCIsIEJFRk9SRV9DREFUQV82LCBJTl9ERUNMQVJBVElPTik7XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQmVmb3JlQ2RhdGE2ID0gZnVuY3Rpb24gKGMpIHtcblx0aWYoYyA9PT0gXCJbXCIpe1xuXHRcdHRoaXMuX3N0YXRlID0gSU5fQ0RBVEE7XG5cdFx0dGhpcy5fc2VjdGlvblN0YXJ0ID0gdGhpcy5faW5kZXggKyAxO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMuX3N0YXRlID0gSU5fREVDTEFSQVRJT047XG5cdH1cbn07XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlSW5DZGF0YSA9IGZ1bmN0aW9uIChjKSB7XG5cdGlmKGMgPT09IFwiXVwiKSB0aGlzLl9zdGF0ZSA9IEFGVEVSX0NEQVRBXzE7XG59O1xuXG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUFmdGVyQ2RhdGExID0gaWZFbHNlU3RhdGUoXCJdXCIsIEFGVEVSX0NEQVRBXzIsIElOX0NEQVRBKTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVBZnRlckNkYXRhMiA9IGZ1bmN0aW9uIChjKSB7XG5cdGlmKGMgPT09IFwiPlwiKXtcblx0XHQvL3JlbW92ZSAyIHRyYWlsaW5nIGNoYXJzXG5cdFx0dGhpcy5fY2JzLm9uY2RhdGEodGhpcy5fYnVmZmVyLnN1YnN0cmluZyh0aGlzLl9zZWN0aW9uU3RhcnQsIHRoaXMuX2luZGV4IC0gMikpO1xuXHRcdHRoaXMuX3N0YXRlID0gVEVYVDtcblx0XHR0aGlzLl9zZWN0aW9uU3RhcnQgPSB0aGlzLl9pbmRleCArIDE7XG5cdH0gZWxzZSBpZiAoYyAhPT0gXCJdXCIpIHtcblx0XHR0aGlzLl9zdGF0ZSA9IElOX0NEQVRBO1xuXHR9XG5cdC8vZWxzZTogc3RheSBpbiBBRlRFUl9DREFUQV8yIChgXV1dPmApXG59O1xuXG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUJlZm9yZVNwZWNpYWwgPSBmdW5jdGlvbiAoYykge1xuXHRpZihjID09PSBcImNcIiB8fCBjID09PSBcIkNcIil7XG5cdFx0dGhpcy5fc3RhdGUgPSBCRUZPUkVfU0NSSVBUXzE7XG5cdH0gZWxzZSBpZihjID09PSBcInRcIiB8fCBjID09PSBcIlRcIil7XG5cdFx0dGhpcy5fc3RhdGUgPSBCRUZPUkVfU1RZTEVfMTtcblx0fSBlbHNlIHtcblx0XHR0aGlzLl9zdGF0ZSA9IElOX1RBR19OQU1FO1xuXHRcdHRoaXMuX2luZGV4LS07IC8vY29uc3VtZSB0aGUgdG9rZW4gYWdhaW5cblx0fVxufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVCZWZvcmVTcGVjaWFsRW5kID0gZnVuY3Rpb24gKGMpIHtcblx0aWYodGhpcy5fc3BlY2lhbCA9PT0gU1BFQ0lBTF9TQ1JJUFQgJiYgKGMgPT09IFwiY1wiIHx8IGMgPT09IFwiQ1wiKSl7XG5cdFx0dGhpcy5fc3RhdGUgPSBBRlRFUl9TQ1JJUFRfMTtcblx0fSBlbHNlIGlmKHRoaXMuX3NwZWNpYWwgPT09IFNQRUNJQUxfU1RZTEUgJiYgKGMgPT09IFwidFwiIHx8IGMgPT09IFwiVFwiKSl7XG5cdFx0dGhpcy5fc3RhdGUgPSBBRlRFUl9TVFlMRV8xO1xuXHR9XG5cdGVsc2UgdGhpcy5fc3RhdGUgPSBURVhUO1xufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVCZWZvcmVTY3JpcHQxID0gY29uc3VtZVNwZWNpYWxOYW1lQ2hhcihcIlJcIiwgQkVGT1JFX1NDUklQVF8yKTtcblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQmVmb3JlU2NyaXB0MiA9IGNvbnN1bWVTcGVjaWFsTmFtZUNoYXIoXCJJXCIsIEJFRk9SRV9TQ1JJUFRfMyk7XG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUJlZm9yZVNjcmlwdDMgPSBjb25zdW1lU3BlY2lhbE5hbWVDaGFyKFwiUFwiLCBCRUZPUkVfU0NSSVBUXzQpO1xuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVCZWZvcmVTY3JpcHQ0ID0gY29uc3VtZVNwZWNpYWxOYW1lQ2hhcihcIlRcIiwgQkVGT1JFX1NDUklQVF81KTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVCZWZvcmVTY3JpcHQ1ID0gZnVuY3Rpb24gKGMpIHtcblx0aWYoYyA9PT0gXCIvXCIgfHwgYyA9PT0gXCI+XCIgfHwgd2hpdGVzcGFjZShjKSl7XG5cdFx0dGhpcy5fc3BlY2lhbCA9IFNQRUNJQUxfU0NSSVBUO1xuXHR9XG5cdHRoaXMuX3N0YXRlID0gSU5fVEFHX05BTUU7XG5cdHRoaXMuX2luZGV4LS07IC8vY29uc3VtZSB0aGUgdG9rZW4gYWdhaW5cbn07XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQWZ0ZXJTY3JpcHQxID0gaWZFbHNlU3RhdGUoXCJSXCIsIEFGVEVSX1NDUklQVF8yLCBURVhUKTtcblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQWZ0ZXJTY3JpcHQyID0gaWZFbHNlU3RhdGUoXCJJXCIsIEFGVEVSX1NDUklQVF8zLCBURVhUKTtcblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQWZ0ZXJTY3JpcHQzID0gaWZFbHNlU3RhdGUoXCJQXCIsIEFGVEVSX1NDUklQVF80LCBURVhUKTtcblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQWZ0ZXJTY3JpcHQ0ID0gaWZFbHNlU3RhdGUoXCJUXCIsIEFGVEVSX1NDUklQVF81LCBURVhUKTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVBZnRlclNjcmlwdDUgPSBmdW5jdGlvbiAoYykge1xuXHRpZihjID09PSBcIj5cIiB8fCB3aGl0ZXNwYWNlKGMpKXtcblx0XHR0aGlzLl9zdGF0ZSA9IElOX0NMT1NJTkdfVEFHX05BTUU7XG5cdFx0dGhpcy5fc2VjdGlvblN0YXJ0ID0gdGhpcy5faW5kZXggLSA2O1xuXHRcdHRoaXMuX2luZGV4LS07IC8vcmVjb25zdW1lIHRoZSB0b2tlblxuXHR9XG5cdGVsc2UgdGhpcy5fc3RhdGUgPSBURVhUO1xufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVCZWZvcmVTdHlsZTEgPSBjb25zdW1lU3BlY2lhbE5hbWVDaGFyKFwiWVwiLCBCRUZPUkVfU1RZTEVfMik7XG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUJlZm9yZVN0eWxlMiA9IGNvbnN1bWVTcGVjaWFsTmFtZUNoYXIoXCJMXCIsIEJFRk9SRV9TVFlMRV8zKTtcblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQmVmb3JlU3R5bGUzID0gY29uc3VtZVNwZWNpYWxOYW1lQ2hhcihcIkVcIiwgQkVGT1JFX1NUWUxFXzQpO1xuXG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUJlZm9yZVN0eWxlNCA9IGZ1bmN0aW9uIChjKSB7XG5cdGlmKGMgPT09IFwiL1wiIHx8IGMgPT09IFwiPlwiIHx8IHdoaXRlc3BhY2UoYykpe1xuXHRcdHRoaXMuX3NwZWNpYWwgPSBTUEVDSUFMX1NUWUxFO1xuXHR9XG5cdHRoaXMuX3N0YXRlID0gSU5fVEFHX05BTUU7XG5cdHRoaXMuX2luZGV4LS07IC8vY29uc3VtZSB0aGUgdG9rZW4gYWdhaW5cbn07XG5cblRva2VuaXplci5wcm90b3R5cGUuX3N0YXRlQWZ0ZXJTdHlsZTEgPSBpZkVsc2VTdGF0ZShcIllcIiwgQUZURVJfU1RZTEVfMiwgVEVYVCk7XG5Ub2tlbml6ZXIucHJvdG90eXBlLl9zdGF0ZUFmdGVyU3R5bGUyID0gaWZFbHNlU3RhdGUoXCJMXCIsIEFGVEVSX1NUWUxFXzMsIFRFWFQpO1xuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVBZnRlclN0eWxlMyA9IGlmRWxzZVN0YXRlKFwiRVwiLCBBRlRFUl9TVFlMRV80LCBURVhUKTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5fc3RhdGVBZnRlclN0eWxlNCA9IGZ1bmN0aW9uIChjKSB7XG5cdGlmKGMgPT09IFwiPlwiIHx8IHdoaXRlc3BhY2UoYykpe1xuXHRcdHRoaXMuX3N0YXRlID0gSU5fQ0xPU0lOR19UQUdfTkFNRTtcblx0XHR0aGlzLl9zZWN0aW9uU3RhcnQgPSB0aGlzLl9pbmRleCAtIDU7XG5cdFx0dGhpcy5faW5kZXgtLTsgLy9yZWNvbnN1bWUgdGhlIHRva2VuXG5cdH1cblx0ZWxzZSB0aGlzLl9zdGF0ZSA9IFRFWFQ7XG59O1xuXG5Ub2tlbml6ZXIucHJvdG90eXBlLl9jbGVhbnVwID0gZnVuY3Rpb24gKCkge1xuXHRpZih0aGlzLl9zZWN0aW9uU3RhcnQgPCAwKXtcblx0XHR0aGlzLl9idWZmZXIgPSBcIlwiO1xuXHRcdHRoaXMuX2luZGV4ID0gMDtcblx0fSBlbHNlIHtcblx0XHRpZih0aGlzLl9zdGF0ZSA9PT0gVEVYVCl7XG5cdFx0XHRpZih0aGlzLl9zZWN0aW9uU3RhcnQgIT09IHRoaXMuX2luZGV4KXtcblx0XHRcdFx0dGhpcy5fY2JzLm9udGV4dCh0aGlzLl9idWZmZXIuc3Vic3RyKHRoaXMuX3NlY3Rpb25TdGFydCkpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fYnVmZmVyID0gXCJcIjtcblx0XHRcdHRoaXMuX2luZGV4ID0gMDtcblx0XHR9IGVsc2UgaWYodGhpcy5fc2VjdGlvblN0YXJ0ID09PSB0aGlzLl9pbmRleCl7XG5cdFx0XHQvL3RoZSBzZWN0aW9uIGp1c3Qgc3RhcnRlZFxuXHRcdFx0dGhpcy5fYnVmZmVyID0gXCJcIjtcblx0XHRcdHRoaXMuX2luZGV4ID0gMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly9yZW1vdmUgZXZlcnl0aGluZyB1bm5lY2Vzc2FyeVxuXHRcdFx0dGhpcy5fYnVmZmVyID0gdGhpcy5fYnVmZmVyLnN1YnN0cih0aGlzLl9zZWN0aW9uU3RhcnQpO1xuXHRcdFx0dGhpcy5faW5kZXggLT0gdGhpcy5fc2VjdGlvblN0YXJ0O1xuXHRcdH1cblxuXHRcdHRoaXMuX3NlY3Rpb25TdGFydCA9IDA7XG5cdH1cbn07XG5cbi8vVE9ETyBtYWtlIGV2ZW50cyBjb25kaXRpb25hbFxuVG9rZW5pemVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uKGNodW5rKXtcblx0dGhpcy5fYnVmZmVyICs9IGNodW5rO1xuXG5cdHdoaWxlKHRoaXMuX2luZGV4IDwgdGhpcy5fYnVmZmVyLmxlbmd0aCAmJiB0aGlzLl9ydW5uaW5nKXtcblx0XHR2YXIgYyA9IHRoaXMuX2J1ZmZlci5jaGFyQXQodGhpcy5faW5kZXgpO1xuXHRcdGlmKHRoaXMuX3N0YXRlID09PSBURVhUKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZVRleHQoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBCRUZPUkVfVEFHX05BTUUpe1xuXHRcdFx0dGhpcy5fc3RhdGVCZWZvcmVUYWdOYW1lKGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gSU5fVEFHX05BTUUpIHtcblx0XHRcdHRoaXMuX3N0YXRlSW5UYWdOYW1lKGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQkVGT1JFX0NMT1NJTkdfVEFHX05BTUUpe1xuXHRcdFx0dGhpcy5fc3RhdGVCZWZvcmVDbG9zZWluZ1RhZ05hbWUoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBJTl9DTE9TSU5HX1RBR19OQU1FKXtcblx0XHRcdHRoaXMuX3N0YXRlSW5DbG9zZWluZ1RhZ05hbWUoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBBRlRFUl9DTE9TSU5HX1RBR19OQU1FKXtcblx0XHRcdHRoaXMuX3N0YXRlQWZ0ZXJDbG9zZWluZ1RhZ05hbWUoYyk7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHQqXHRhdHRyaWJ1dGVzXG5cdFx0Ki9cblx0XHRlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBCRUZPUkVfQVRUUklCVVRFX05BTUUpe1xuXHRcdFx0dGhpcy5fc3RhdGVCZWZvcmVBdHRyaWJ1dGVOYW1lKGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gSU5fQVRUUklCVVRFX05BTUUpe1xuXHRcdFx0dGhpcy5fc3RhdGVJbkF0dHJpYnV0ZU5hbWUoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBBRlRFUl9BVFRSSUJVVEVfTkFNRSl7XG5cdFx0XHR0aGlzLl9zdGF0ZUFmdGVyQXR0cmlidXRlTmFtZShjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEJFRk9SRV9BVFRSSUJVVEVfVkFMVUUpe1xuXHRcdFx0dGhpcy5fc3RhdGVCZWZvcmVBdHRyaWJ1dGVWYWx1ZShjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IElOX0FUVFJJQlVURV9WQUxVRV9ET1VCTEVfUVVPVEVTKXtcblx0XHRcdHRoaXMuX3N0YXRlSW5BdHRyaWJ1dGVWYWx1ZURvdWJsZVF1b3RlcyhjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IElOX0FUVFJJQlVURV9WQUxVRV9TSU5HTEVfUVVPVEVTKXtcblx0XHRcdHRoaXMuX3N0YXRlSW5BdHRyaWJ1dGVWYWx1ZVNpbmdsZVF1b3RlcyhjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IElOX0FUVFJJQlVURV9WQUxVRV9OT19RVU9URVMpe1xuXHRcdFx0dGhpcy5fc3RhdGVJbkF0dHJpYnV0ZVZhbHVlTm9RdW90ZXMoYyk7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHQqXHRkZWNsYXJhdGlvbnNcblx0XHQqL1xuXHRcdGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEJFRk9SRV9ERUNMQVJBVElPTil7XG5cdFx0XHR0aGlzLl9zdGF0ZUJlZm9yZURlY2xhcmF0aW9uKGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gSU5fREVDTEFSQVRJT04pe1xuXHRcdFx0dGhpcy5fc3RhdGVJbkRlY2xhcmF0aW9uKGMpO1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0Klx0cHJvY2Vzc2luZyBpbnN0cnVjdGlvbnNcblx0XHQqL1xuXHRcdGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IElOX1BST0NFU1NJTkdfSU5TVFJVQ1RJT04pe1xuXHRcdFx0dGhpcy5fc3RhdGVJblByb2Nlc3NpbmdJbnN0cnVjdGlvbihjKTtcblx0XHR9XG5cblx0XHQvKlxuXHRcdCpcdGNvbW1lbnRzXG5cdFx0Ki9cblx0XHRlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBCRUZPUkVfQ09NTUVOVCl7XG5cdFx0XHR0aGlzLl9zdGF0ZUJlZm9yZUNvbW1lbnQoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBJTl9DT01NRU5UKXtcblx0XHRcdHRoaXMuX3N0YXRlSW5Db21tZW50KGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQUZURVJfQ09NTUVOVF8xKXtcblx0XHRcdHRoaXMuX3N0YXRlQWZ0ZXJDb21tZW50MShjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEFGVEVSX0NPTU1FTlRfMil7XG5cdFx0XHR0aGlzLl9zdGF0ZUFmdGVyQ29tbWVudDIoYyk7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHQqXHRjZGF0YVxuXHRcdCovXG5cdFx0ZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQkVGT1JFX0NEQVRBXzEpe1xuXHRcdFx0dGhpcy5fc3RhdGVCZWZvcmVDZGF0YTEoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBCRUZPUkVfQ0RBVEFfMil7XG5cdFx0XHR0aGlzLl9zdGF0ZUJlZm9yZUNkYXRhMihjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEJFRk9SRV9DREFUQV8zKXtcblx0XHRcdHRoaXMuX3N0YXRlQmVmb3JlQ2RhdGEzKGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQkVGT1JFX0NEQVRBXzQpe1xuXHRcdFx0dGhpcy5fc3RhdGVCZWZvcmVDZGF0YTQoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBCRUZPUkVfQ0RBVEFfNSl7XG5cdFx0XHR0aGlzLl9zdGF0ZUJlZm9yZUNkYXRhNShjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEJFRk9SRV9DREFUQV82KXtcblx0XHRcdHRoaXMuX3N0YXRlQmVmb3JlQ2RhdGE2KGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gSU5fQ0RBVEEpe1xuXHRcdFx0dGhpcy5fc3RhdGVJbkNkYXRhKGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQUZURVJfQ0RBVEFfMSl7XG5cdFx0XHR0aGlzLl9zdGF0ZUFmdGVyQ2RhdGExKGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQUZURVJfQ0RBVEFfMil7XG5cdFx0XHR0aGlzLl9zdGF0ZUFmdGVyQ2RhdGEyKGMpO1xuXHRcdH1cblxuXHRcdC8qXG5cdFx0KiBzcGVjaWFsIHRhZ3Ncblx0XHQqL1xuXHRcdGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEJFRk9SRV9TUEVDSUFMKXtcblx0XHRcdHRoaXMuX3N0YXRlQmVmb3JlU3BlY2lhbChjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEJFRk9SRV9TUEVDSUFMX0VORCl7XG5cdFx0XHR0aGlzLl9zdGF0ZUJlZm9yZVNwZWNpYWxFbmQoYyk7XG5cdFx0fVxuXG5cdFx0Lypcblx0XHQqIHNjcmlwdFxuXHRcdCovXG5cdFx0ZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQkVGT1JFX1NDUklQVF8xKXtcblx0XHRcdHRoaXMuX3N0YXRlQmVmb3JlU2NyaXB0MShjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEJFRk9SRV9TQ1JJUFRfMil7XG5cdFx0XHR0aGlzLl9zdGF0ZUJlZm9yZVNjcmlwdDIoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBCRUZPUkVfU0NSSVBUXzMpe1xuXHRcdFx0dGhpcy5fc3RhdGVCZWZvcmVTY3JpcHQzKGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQkVGT1JFX1NDUklQVF80KXtcblx0XHRcdHRoaXMuX3N0YXRlQmVmb3JlU2NyaXB0NChjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEJFRk9SRV9TQ1JJUFRfNSl7XG5cdFx0XHR0aGlzLl9zdGF0ZUJlZm9yZVNjcmlwdDUoYyk7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQUZURVJfU0NSSVBUXzEpe1xuXHRcdFx0dGhpcy5fc3RhdGVBZnRlclNjcmlwdDEoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBBRlRFUl9TQ1JJUFRfMil7XG5cdFx0XHR0aGlzLl9zdGF0ZUFmdGVyU2NyaXB0MihjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEFGVEVSX1NDUklQVF8zKXtcblx0XHRcdHRoaXMuX3N0YXRlQWZ0ZXJTY3JpcHQzKGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQUZURVJfU0NSSVBUXzQpe1xuXHRcdFx0dGhpcy5fc3RhdGVBZnRlclNjcmlwdDQoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBBRlRFUl9TQ1JJUFRfNSl7XG5cdFx0XHR0aGlzLl9zdGF0ZUFmdGVyU2NyaXB0NShjKTtcblx0XHR9XG5cblx0XHQvKlxuXHRcdCogc3R5bGVcblx0XHQqL1xuXHRcdGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEJFRk9SRV9TVFlMRV8xKXtcblx0XHRcdHRoaXMuX3N0YXRlQmVmb3JlU3R5bGUxKGMpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gQkVGT1JFX1NUWUxFXzIpe1xuXHRcdFx0dGhpcy5fc3RhdGVCZWZvcmVTdHlsZTIoYyk7XG5cdFx0fSBlbHNlIGlmKHRoaXMuX3N0YXRlID09PSBCRUZPUkVfU1RZTEVfMyl7XG5cdFx0XHR0aGlzLl9zdGF0ZUJlZm9yZVN0eWxlMyhjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEJFRk9SRV9TVFlMRV80KXtcblx0XHRcdHRoaXMuX3N0YXRlQmVmb3JlU3R5bGU0KGMpO1xuXHRcdH1cblxuXHRcdGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEFGVEVSX1NUWUxFXzEpe1xuXHRcdFx0dGhpcy5fc3RhdGVBZnRlclN0eWxlMShjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEFGVEVSX1NUWUxFXzIpe1xuXHRcdFx0dGhpcy5fc3RhdGVBZnRlclN0eWxlMihjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEFGVEVSX1NUWUxFXzMpe1xuXHRcdFx0dGhpcy5fc3RhdGVBZnRlclN0eWxlMyhjKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IEFGVEVSX1NUWUxFXzQpe1xuXHRcdFx0dGhpcy5fc3RhdGVBZnRlclN0eWxlNChjKTtcblx0XHR9XG5cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuX2Nicy5vbmVycm9yKEVycm9yKFwidW5rbm93biBfc3RhdGVcIiksIHRoaXMuX3N0YXRlKTtcblx0XHR9XG5cblx0XHR0aGlzLl9pbmRleCsrO1xuXHR9XG5cblx0dGhpcy5fY2xlYW51cCgpO1xufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCl7XG5cdHRoaXMuX3J1bm5pbmcgPSBmYWxzZTtcbn07XG5Ub2tlbml6ZXIucHJvdG90eXBlLnJlc3VtZSA9IGZ1bmN0aW9uKCl7XG5cdHRoaXMuX3J1bm5pbmcgPSB0cnVlO1xufTtcblxuVG9rZW5pemVyLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbihjaHVuayl7XG5cdGlmKGNodW5rKSB0aGlzLndyaXRlKGNodW5rKTtcblxuXHQvL2lmIHRoZXJlIGlzIHJlbWFpbmluZyBkYXRhLCBlbWl0IGl0IGluIGEgcmVhc29uYWJsZSB3YXlcblx0aWYodGhpcy5fc2VjdGlvblN0YXJ0ID4gdGhpcy5faW5kZXgpe1xuXHRcdHZhciBkYXRhID0gdGhpcy5fYnVmZmVyLnN1YnN0cih0aGlzLl9zZWN0aW9uU3RhcnQpO1xuXG5cdFx0aWYodGhpcy5fc3RhdGUgPT09IElOX0NEQVRBIHx8IHRoaXMuX3N0YXRlID09PSBBRlRFUl9DREFUQV8xIHx8IHRoaXMuX3N0YXRlID09PSBBRlRFUl9DREFUQV8yKXtcblx0XHRcdHRoaXMuX2Nicy5vbmNkYXRhKGRhdGEpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gSU5fQ09NTUVOVCB8fCB0aGlzLl9zdGF0ZSA9PT0gQUZURVJfQ09NTUVOVF8xIHx8IHRoaXMuX3N0YXRlID09PSBBRlRFUl9DT01NRU5UXzIpe1xuXHRcdFx0dGhpcy5fY2JzLm9uY29tbWVudChkYXRhKTtcblx0XHR9IGVsc2UgaWYodGhpcy5fc3RhdGUgPT09IElOX1RBR19OQU1FKXtcblx0XHRcdHRoaXMuX2Nicy5vbm9wZW50YWduYW1lKGRhdGEpO1xuXHRcdH0gZWxzZSBpZih0aGlzLl9zdGF0ZSA9PT0gSU5fQ0xPU0lOR19UQUdfTkFNRSl7XG5cdFx0XHR0aGlzLl9jYnMub25jbG9zZXRhZyhkYXRhKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY2JzLm9udGV4dChkYXRhKTtcblx0XHR9XG5cdH1cblxuXHR0aGlzLl9jYnMub25lbmQoKTtcbn07XG5cblRva2VuaXplci5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbigpe1xuXHRUb2tlbml6ZXIuY2FsbCh0aGlzLCB7eG1sTW9kZTogdGhpcy5feG1sTW9kZX0sIHRoaXMuX2Nicyk7XG59O1xuXG5Ub2tlbml6ZXIucHJvdG90eXBlLl9nZXRTZWN0aW9uID0gZnVuY3Rpb24oKXtcblx0cmV0dXJuIHRoaXMuX2J1ZmZlci5zdWJzdHJpbmcodGhpcy5fc2VjdGlvblN0YXJ0LCB0aGlzLl9pbmRleCk7XG59O1xuXG5Ub2tlbml6ZXIucHJvdG90eXBlLl9lbWl0VG9rZW4gPSBmdW5jdGlvbihuYW1lKXtcblx0dGhpcy5fY2JzW25hbWVdKHRoaXMuX2dldFNlY3Rpb24oKSk7XG5cdHRoaXMuX3NlY3Rpb25TdGFydCA9IC0xO1xufTtcbiJdfQ==
(1)
});
;