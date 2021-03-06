function Scene_MainMenu() {
  this.init.apply(this, arguments);
}

Scene_MainMenu.prototype = Object.create(Scene_MenuBase.prototype);
Scene_MainMenu.prototype.constructor = Scene_MainMenu;

Scene_MainMenu.prototype.init = function() {
  Scene_MenuBase.prototype.init.call(this);
}

Scene_MainMenu.prototype.initMembers = function() {
  Scene_MenuBase.prototype.initMembers.call(this);
}

Scene_MainMenu.prototype.create = function() {
  Scene_MenuBase.prototype.create.call(this);
  AudioManager.playBgm("bgmTitle");
  this.fadeIn();
}

Scene_MainMenu.prototype.continue = function() {
  Scene_MenuBase.prototype.continue.call(this);
  AudioManager.playBgm("bgmTitle");
  this.fadeIn();
}

Scene_MainMenu.prototype.update = function() {
  Scene_MenuBase.prototype.update.call(this);
}

Scene_MainMenu.prototype.createCommands = function() {
  Scene_MenuBase.prototype.createCommands.call(this);
  // Options
  var elem = new UI_MenuButton(new Point(Core.resolution.x * 0.8, 400), "Options");
  elem.x -= elem.sprite.width / 2;
  elem.onClick.add(this.fadeOut, this, [function() {
    SceneManager.push(new Scene_Options());
  }]);
  this.addUI(elem);
  // Play
  var elem = new UI_MenuButton(new Point(Core.resolution.x * 0.2, 400), "Play");
  elem.x -= elem.sprite.width / 2;
  elem.onClick.add(this.fadeOut, this, [function() {
    SceneManager.push(new Scene_WorldMap());
  }]);
  this.addUI(elem);
  // Exit
  if(Core.usingElectron) {
    var elem = new UI_MenuButton(new Point(Core.resolution.x * 0.5, 600), "Exit");
    elem.x -= elem.sprite.width / 2;
    elem.onClick.add(this.fadeOut, this, [function() {
      close();
    }]);
    this.addUI(elem);
  }
}
