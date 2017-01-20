'use strict';

const Registry = require('winreg')
const path = require('path')
const {app} = require('electron')
const Q = require('q')

const {$create, $set} = require('./util')
const ShellOption = require('./shelloption')

function ProgId({
    progExt = '',
    appName = app.getName(),
    hive = Registry.HKCU,
    icon,
    shell = [],
    extensions = []
}) {
    this.progId = progExt ? `${appName}.${progExt}` : `${appName}`
    this.appName = appName
    this.hive = hive
    this.icon = icon
    this.extensions = extensions
    this.shell = bindShells(this, shell)
    this.BASE_KEY = `\\Software\\Classes\\${this.appName}`

}

function bindShells(prog, shell) {
    if (Array.isArray(shell) && shell.length === 0) {
        shell.push(new ShellOption({}))
    }

    return shell.map((s) => s.bindProg(prog))
}

ProgId.prototype.install = function () {
    if(process.platform !== 'win32') {
        return false;
    }

    let self = this

    let registry = new Registry({
        hive: this.hive,
        key: this.BASE_KEY
    })

    return $create(registry)
        .then(() => registerIcon())
        .then(() => registerShellCommands())
        .then(() => registerFileAssociations())


    function registerIcon() {
        if (!self.icon) return

        let iconPath
        if (path.isAbsolute(self.icon)) {
            iconPath = self.icon
        } else {
            iconPath = path.join(process.execPath, '..', self.icon)
        }

        let defaultIcon = new Registry({
            hive: self.hive,
            key: `${self.BASE_KEY}\\DefaultIcon`
        })

        return $create(defaultIcon)
            .then(() => $set(defaultIcon, Registry.DEFAULT_VALUE, Registry.REG_SZ, iconPath))
    }

    function registerShellCommands() {
        let shells = self.shell.map(shell => shell.install())
        return Q.all(shells)
    }

    function registerFileAssociations() {
        let extensions = self.extensions.map((ext) => registerFileExtension(ext))
        return Q.all(extensions)
    }

    function registerFileExtension(ext) {
        let registry = new Registry({
            hive: self.hive,
            key: `\\Software\\Classes\\.${ext}\\OpenWithProgids`
        })

        return $create(registry).then(() =>
            $set(registry, self.progId, Registry.REG_SZ, '')
        )
    }
};

module.exports = ProgId