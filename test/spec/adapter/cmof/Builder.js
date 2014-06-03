var _ = require('lodash'),
    fs = require('fs'),
    path = require('path');

var CmofParser = require('cmof-parser');

var Helper = require('../../Helper');


function Builder() {

  var desc;

  var hooks = {
    'preSerialize': []
  };

  function getPackage() {
    var elementsById = desc.byId;
    return elementsById['_0'];
  }

  function swapProperties(desc, prop1, prop2) {
    var props = desc.properties;

    function findProperty(name) {
      return _.find(props, function(d) {
        return d.name === name;
      });
    }

    var p1 = findProperty(prop1);
    var p2 = findProperty(prop2);

    var idx1 = props.indexOf(p1);
    var idx2 = props.indexOf(p2);

    props[idx1] = p2;
    props[idx2] = p1;
  }

  function exportTo(file) {

    var pkg = getPackage();

    var str = JSON.stringify(pkg, null, '  ');

    _.forEach(hooks.preSerialize, function(fn) {
      str = fn(str);
    });

    fs.writeFileSync(file, str);
  }

  function preSerialize(fn) {
    hooks.preSerialize.push(fn);
  }

  function rename(oldType, newType) {
    preSerialize(function(str) {
      return str.replace(new RegExp(oldType, 'g'), newType);
    });
  }

  function alter(elementName, extension) {

    var elementParts = elementName.split('#');

    var elementsById = desc.byId;

    var element = elementsById[elementParts[0]];

    if (!element) {
      throw new Error('[transform] element <' + elementParts[0] + '> does not exist');
    }

    if (elementParts[1]) {
      var property = _.find(element.properties, function(p) {
        return p.name === elementParts[1];
      });

      if (!property) {
        throw new Error('[transform] property <' + elementParts[0] + '#' + elementParts[1] + '> does not exist');
      }

      if (_.isFunction(extension)) {
        extension.call(element, property);
      } else {
        _.extend(property, extension);
      }
    } else {
      if (_.isFunction(extension)) {
        extension.call(element, element);
      } else {
        _.extend(element, extension);
      }
    }
  }

  function cleanIDs() {

    preSerialize(function(str) {

      // remove "id": "Something" lines
      return str.replace(/,\n\s+"id": "[^"]+"/g, '');
    });
  }

  function parse(file, postParse, done) {

    new CmofParser({ clean: true }).parseFile(file, function(err, _desc) {
      if (err) {
        done(err);
      } else {
        desc = _desc;

        try {
          postParse(getPackage(), desc);
          done(null);
        } catch (e) {
          done(e);
        }
      }
    });
  }

  function write(dest) {
    var dir = path.dirname(dest);
    Helper.ensureDirExists(dir);
  }

  this.parse = parse;
  this.alter = alter;
  this.rename = rename;
  this.swapProperties = swapProperties;

  this.cleanIDs = cleanIDs;
  this.exportTo = exportTo;
}

module.exports = Builder;