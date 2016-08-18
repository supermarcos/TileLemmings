function Map() {
  this.init.apply(this, arguments);
}

Object.defineProperties(Map.prototype, {
  realWidth: {
    get: function() { return this.width * this.tileWidth; }
  },
  realHeight: {
    get: function() { return this.height * this.tileHeight; }
  }
});

Map.prototype.init = function(src, scene) {
  this.world           = new World();
  this.camera          = new Camera(this);
  this.scene           = scene;
  this.tilesets        = [];
  this._expectedAssets = [];
  this._usedAssets     = [];
  this.width           = 1;
  this.height          = 1;
  this.tileWidth       = 16;
  this.tileHeight      = 16;
  this.tiles           = [];
  this.objects         = [];
  this.needed          = 1;
  this.totalLemmings   = 0;
  this.name            = "No Name";
  this.pool            = {};

  this.onLoad = new Signal();
  this.onLoad.addOnce(this.createLevel, this, [], 5);

  this.baseDir = src.split(/[\/\\]/).slice(0, -1).join("/") + "/";
  var obj = Loader.loadJSON("map", src);
  obj.onComplete.addOnce(this.parseTiledMap, this);
}

Map.prototype.parseTiledMap = function() {
  this.data = Cache.getJSON("map");
  // Apply Map Properties
  if(this.data.properties) {
    if(this.data.properties.needed) this.needed = this.data.properties.needed;
    if(this.data.properties.name) this.name = this.data.properties.name;
  }
  // Load Music
  if(this.data.properties.music) {
    var obj = Loader.loadAudio("music", AudioManager.baseDir("bgm") + this.data.properties.music + ".ogg");
    this._expectedAssets.push("music");
    obj.onComplete.addOnce(function() {
      this.clearAsset("music");
    }, this, [], 20);
  }
  // Load Tilesets
  for(var a = 0;a < this.data.tilesets.length;a++) {
    var ts = this.data.tilesets[a];
    var key = "tileset" + a.toString();
    var tsBaseDir = this.baseDir + ts.source.split(/[\/\\]/).slice(0, -1).join("/") + "/";
    var args = [key, ts.firstgid, tsBaseDir, true];

    if(ts.source.split(/[\/\\]/).indexOf("generic") !== -1) args[3] = false;
    this._expectedAssets.push(key);
    var obj = Loader.loadJSON(key, this.baseDir + ts.source);
    obj.onComplete.addOnce(this.parseTilesetData, this, args, 20);
  }
}

Map.prototype.parseTilesetData = function(key, firstGid, baseDir, loadImage) {
  var tsData = Cache.getJSON(key);
  var ts = new Tileset();
  ts.margin         = tsData.margin;
  ts.spacing        = tsData.spacing;
  ts.tileWidth      = tsData.tilewidth;
  ts.tileHeight     = tsData.tileheight;
  ts.firstGid       = firstGid;
  ts.tileProperties = tsData.tileproperties ? tsData.tileproperties : null;

  if(loadImage) {
    var imageKey = key + "_image";
    this._expectedAssets.push(imageKey);
    var src = baseDir + tsData.image;
    var obj = Loader.loadImage(imageKey, src);
    obj.onComplete.addOnce(this.parseTileset, this, [imageKey, ts], 20);
  }
  else {
    this.tilesets.push(ts);
  }

  this._usedAssets.push({ type: "json", key: key });
  this.clearAsset(key);
}

Map.prototype.parseTileset = function(imageKey, tileset) {
  tileset.texture = Cache.getImage(imageKey);
  this.tilesets.push(tileset);

  this._usedAssets.push({ type: "image", key: imageKey });
  this.clearAsset(imageKey);
}

Map.prototype.clearAsset = function(key) {
  var a = this._expectedAssets.indexOf(key);
  if(a !== -1) {
    this._expectedAssets.splice(a, 1);
    if(this._expectedAssets.length === 0) {
      this.tilesets.sort(function(a, b) {
        if(a.firstGid < b.firstGid) return -1;
        if(a.firstGid > b.firstGid) return 1;
        return 0;
      });
      this.onLoad.dispatch();
    }
  }
}

Map.prototype.getTileset = function(uid) {
  for(var a = this.tilesets.length - 1;a >= 0;a--) {
    var ts = this.tilesets[a];
    if(uid >= ts.firstGid) return ts;
  }
  return null;
}

Map.prototype.createLevel = function() {
  this.width = this.data.width;
  this.height = this.data.height;
  this.tileWidth = this.data.tilewidth;
  this.tileHeight = this.data.tileheight;
  // Resize
  while(this.tiles.length < this.width * this.height) {
    this.tiles.push(null);
  }
  // Parse layers
  for(var a = 0;a < this.data.layers.length;a++) {
    var layer = this.data.layers[a];
    // Tile Layer
    if(layer.type === "tilelayer") {
      this.parseTileLayer(layer);
    }
    // Object Layer
    else if(layer.type === "objectgroup") {
      this.parseObjectLayer(layer);
    }
  }

  // Create lemming pool
  this.pool.lemming = new Pool("Game_Lemming", this, [], this.totalLemmings);
}

Map.prototype.parseTileLayer = function(layer) {
  for(var a = 0;a < layer.data.length;a++) {
    var uid = layer.data[a];
    if(uid > 0) {
      var pos = this.getTilePosition(a);
      this.addTile(pos.x, pos.y, uid, 0);
    }
  }
}

Map.prototype.parseObjectLayer = function(layer) {
  for(var a = 0;a < layer.objects.length;a++) {
    var objData = layer.objects[a];
    var ts = this.getTileset(objData.gid);
    if(ts) {
      var props = ts.getTileProperties(objData.gid - ts.firstGid);
      if(props) {
        var obj;
        if(props.type === "prop") {
          obj = this.addProp(objData.x, objData.y, props.key, objData);
        }
      }
    }
  }
}

Map.prototype.addProp = function(x, y, key, data) {
  // Create object
  var obj = new Game_Prop(key);
  obj.map = this;
  obj.x = x;
  obj.y = y;
  this.objects.push(obj);
  // Reposition
  var src = $dataProps[obj.key];
  obj.x += (data.width * src.anchor.x);
  obj.y += (data.height * src.anchor.y);
  // Apply Properties
  if(data.properties) {
    // Door
    if(obj.type === "door") {
      // Value/Lemming Count
      if(data.properties.value) {
        this.totalLemmings += data.properties.value;
        obj.value = data.properties.value;
      }
      // Rate
      if(data.properties.rate) obj.rate = data.properties.rate;
    }
  }
  // Add to world
  this.world.addChild(obj.sprite);
}

Map.prototype.addTile = function(x, y, uid, flags) {
  if(!flags) flags = 0;
  var ts = this.getTileset(uid);
  if(ts) {
    var index = this.getTileIndex(x, y);
    // Add new tile
    var tile = new Tile(ts.getTileTexture(uid - ts.firstGid));
    tile.x = x * this.tileWidth;
    tile.y = y * this.tileHeight;
    this.world.addChild(tile.sprite);
    // Remove old tile
    var oldTile = this.tiles.splice(index, 1, tile)[0];
    if(oldTile instanceof Tile) oldTile.sprite.destroy(true);
  }
}

Map.prototype.removeTile = function(x, y) {
  var index = this.getTileIndex(x, y);
  var oldTile = this.tiles.splice(index, 1, null)[0];
  if(oldTile instanceof Tile) {
    oldTile.sprite.destroy(true);
    return true;
  }
  return false;
}

Map.prototype.getTileIndex = function(x, y) {
  return x + (y * this.width);
}

Map.prototype.getTilePosition = function(index) {
  return new Point(
    Math.floor(index % this.width),
    Math.floor(index / this.width)
  );
}

Map.prototype.setStage = function(stage) {
  stage.addChild(this.world);
}

Map.prototype.removeAssetsFromCache = function() {
  while(this._usedAssets.length > 0) {
    var asset = this._usedAssets.pop();
    switch(asset.type) {
      case "json":
        Cache.removeJSON(asset.key);
        break;
      case "image":
        Cache.removeImage(asset.key);
        break;
      case "audio":
        Cache.removeAudio(asset.key);
        break;
    }
  }
}

Map.prototype.update = function() {
  this.camera.update();
  // Update tiles
  var arr = this.tiles.slice();
  for(var a = 0;a < arr.length;a++) {
    var t = arr[a];
    if(t) {
      if(this.camera.contains(t.sprite)) t.sprite.visible = true;
      else t.sprite.visible = false;
    }
  }
  // Update objects
  var arr = this.objects.slice();
  for(var a = 0;a < arr.length;a++) {
    var o = arr[a];
    if(o.exists) {
      o.update();
      if(this.camera.contains(o.sprite)) o.sprite.visible = true;
      else o.sprite.visible = false;
    }
  }
}

Map.prototype.getLemmings = function() {
  return this.objects.filter(function(obj) {
    return (obj instanceof Game_Lemming);
  });
}

Map.prototype.getDoors = function() {
  return this.objects.filter(function(obj) {
    return (obj instanceof Game_Prop && obj.type === "door");
  });
}

Map.prototype.startMusic = function() {
  AudioManager.playBgm("music");
}
