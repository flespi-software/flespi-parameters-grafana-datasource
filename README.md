### The _flespi-parameters-datasource_ plugin works with grafana 10+

![Logo](https://github.com/flespi-software/flespi-parameters-grafana-datasource/blob/main/src/img/logo.svg "flespi parameters grafana plugin")

Plugin allows to visualize parameters of [flespi devices](https://flespi.io/docs/#/gw/!/devices).

### Installation

As soon as _flespi-parameters-datasource_ plugin is not signed, in order to be able to install and run the plugin, you should specify plugin's id in [allow_loading_unsigned_plugins](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#allow_loading_unsigned_plugins) Grafana configuration variable:

```
allow_loading_unsigned_plugins = flespi-parameters-datasource
```

To install this plugin using the [grafana cli](https://grafana.com/docs/grafana/latest/cli/) tool, execute the following command:
```
cd /usr/share/grafana/bin
sudo ./grafana cli --pluginUrl https://github.com/flespi-software/flespi-parameters-grafana-datasource/archive/master.zip plugins install flespi-parameters-datasource
```
and then restart your grafana server.

Alternatively, you may manually copy `flespi-parameters-datasource` directory into grafana plugins directory and restart grafana server.
By default plugins directory is: `/var/lib/grafana/plugins`
To check plugins directory in Grafana interface open: Toggle menu in top left corner > Administration > Settings > paths/plugins

To remove plugin run:
```
cd /usr/share/grafana/bin
sudo ./grafana cli plugins remove flespi-parameters-datasource
```

### To setup the datasource you need to configure your [Flespi Token](https://flespi.com/kb/tokens-access-keys-to-flespi-platform) in datasource's settings.

### Plugin supports template variables. 
The following queries can be used to create variable:

| Query                              | Description                                             |
| ---------------------------------- |:-------------------------------------------------------:|
| devices.*                          | fetch all devices available for given token             |
| devices.${device}.parameters.*     | fetch numeric parameters for the selected device        |


### Dev setup

To install frontend dependencies run:

`npm install`

To build and watch the plugin frontend code:

`npm run dev`

### Changelog

1.0.0
  Initial implementation