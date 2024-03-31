### The _flespi-parameters-datasource_ plugin works with grafana 10+

![Logo](https://github.com/flespi-software/flespi-parameters-grafana-datasource/blob/main/src/img/logo.svg "flespi parameters grafana plugin")

Plugin allows to visualize parameters of [flespi devices](https://flespi.io/docs/#/gw/!/devices).

### Installation

________________________________________________

1. Install grafana as standalone binaries
    - <details>
        <summary>MacOS installation</summary>

        You can find the latest version of the commands here: [Install Grafana](https://grafana.com/grafana/download?edition=oss&pg=get&platform=mac&plcmt=selfmanaged-box1-cta1)

        ```bash
        curl -O https://dl.grafana.com/oss/release/grafana-10.2.3.darwin-amd64.tar.gz

        tar -zxvf grafana-10.2.3.darwin-amd64.tar.gz
        ```
      </details>

    - <details>
        <summary>Linux installation</summary>

        You can find the latest version of the commands here: [Install Grafana](https://grafana.com/grafana/download?edition=oss&pg=get&platform=linux&plcmt=selfmanaged-box1-cta1)

        ```bash
        curl -O https://dl.grafana.com/oss/release/grafana-10.2.3.linux-amd64.tar.gz

        tar -zxvf grafana-10.2.3.linux-amd64.tar.gz
        ```

      </details>

2. <details>
    <summary>Install plugin</summary>

    ```bash
    cd grafana-v10.2.3

    mkdir  -p ./data/plugins

    ./bin/grafana cli --pluginsDir ./data/plugins --pluginUrl https://github.com/flespi-software/flespi-parameters-grafana-datasource/archive/master.zip plugins install flespi-parameters-datasource
    ```
    As soon as _flespi-parameters-datasource_ plugin is not signed, in order to be able to install and run the plugin, you should specify plugin's id in [allow_loading_unsigned_plugins](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#allow_loading_unsigned_plugins) Grafana configuration variable.

    Make copy of your `./conf/defaults.ini`
    ```bash
    cp ./conf/defaults.ini ./conf/custom.ini
    ```

    Now edit your `./conf/custom.ini` and set
    ```bash
    allow_loading_unsigned_plugins = flespi-parameters-datasource
    ```

    Start grafana server

    ```bash
    ./bin/grafana server
    ```
  </details>

________________________________________________

<details>
  <summary>Ubuntu/Debian system-wide installation</summary>

  ```
  sudo apt-get install -y adduser libfontconfig1 musl

  wget https://dl.grafana.com/oss/release/grafana_10.2.3_amd64.deb

  sudo dpkg -i grafana_10.2.3_amd64.deb
  ```
  You can find the latest version of the commands here: [Install Grafana](https://grafana.com/grafana/download?edition=oss&pg=get&platform=linux&plcmt=selfmanaged-box1-cta1)

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

</details>

________________________________________________

### To setup the datasource you need to configure your [Flespi Token](https://flespi.com/kb/tokens-access-keys-to-flespi-platform) in datasource's settings.

### Plugin supports template variables.
The following queries can be used to create variable:

| Query                               | Description                                                 |
| ------------------------------------|:-----------------------------------------------------------:|
| devices.*                           | fetch all devices available for given token                 |
| devices.${device}.parameters.*      | fetch telemetry parameters for the selected device          |
| accounts.*                          | fetch account and subaccounts available for given token     |
| accounts.${account}.statistics.*    | fetch statistics parameters for the selected (sub)accounts  |
| streams.*                           | fetch all streams available for given token                 |
| containers.*                        | fetch all containers available for given token              |
| containers.${container}.parameters.*| fetch parameters of the selected container                  |


### Dev setup

To install frontend dependencies run:

`npm install`

To build and watch the plugin frontend code:

`npm run dev`

### Changelog

1.0.0
  Initial implementation
  
1.1.0
  Added visualization of flespi accounts' statistics