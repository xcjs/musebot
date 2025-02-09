# SwarmUI Integration

![SwarmUI Logo](../../assets/images/logos/swarmui.jpg)

[SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI) is a media studio
application for image, video, and other multimedia generation. It primarily acts
as a beginner-friendly wrapper for
[ComfyUI](https://github.com/comfyanonymous/ComfyUI).

ComfyUI performs most of the actual work for SwarmUI and is a complex node-based
workflow editor for the aforementioned multimedia and corresponding generative
AI models.

While this document covers integration with SwarmUI, some information
specific to [ComfyUI is provided as well](../comfyui/index.html).

We do recommend beginning with SwarmUI for two reasons:

1. SwarmUI can automatically identify and download ancillary models that are
   required by models you choose to import.
2. Musebot is developed against SwarmUI and example workflows provided with
   Musebot are made with custom ComfyUI nodes bundled with SwarmUI.

As usual, we recommend you refer to the
[SwarmUI documentation](https://github.com/mcmonkeyprojects/SwarmUI/blob/master/README.md)
for configuring and installing SwarmUI.

## 1. Install Custom Nodes

Once you have SwarmUI installed and running, we recommend installing some custom
nodes that are either useful or required for Musebot to function.

Inside the SwarmUI directory (usually installed as `swarmui`), you'll find
the ComfyUI installation in `swarmui/dlbackend/ComfyUI/`. We're interested in
the `custom_nodes` directory within. Go ahead and navigate to that directory
in your preferred shell.

1. Install [ComfyUI-Manager](https://github.com/ltdrdata/ComfyUI-Manager). This
   does require that you have both `git` and `python` (version 3) installed.

   ```bash
    git clone https://github.com/ltdrdata/ComfyUI-Manager comfyui-manager
   ```

   Restart SwarmUI and/or ComfyUI if you want to use the manager. The ComfyUI
   backend can be restarted independently of SwarmUI from within the SwarmUI
   interface. Once ComfyUI-Manager is installed, many of the following custom
   nodes can be installed from within it through the "Custom Nodes Manager", or
   you can continue with the following provided CLI instructions.

   ![ComfyUI-Manager](../../assets/images/comfyui/comfyui-manager.jpg)
2. Install [ComfyUI-KJNodes](https://github.com/kijai/ComfyUI-KJNodes):

   ```bash
    git clone https://github.com/kijai/ComfyUI-KJNodes.git
    pip install -r requirements.txt
   ```

3. Install
   [ComfyUI-Unload-Model](https://github.com/SeanScripts/ComfyUI-Unload-Model)

   ```bash
    git clone https://github.com/SeanScripts/ComfyUI-Unload-Model.git
   ```

4. Install
   [comfyui-tooling-nodes](https://github.com/Acly/comfyui-tooling-nodes).

   ```bash
    git clone https://github.com/Acly/comfyui-tooling-nodes.git
   ```

5. Restart SwarmUI and/or ComfyUI. Once again, the ComfyUI backend can be
   restarted from within SwarmUI. (`Server` tab » `Backends` tab » `Restart All
   Backends` button)

## 2. Enable Dev Mode

1. Navigate to the `Comfy Workflow` tab in SwarmUI.
2. Look for the large gear icon in the bottom left of ComfyUI.

   ![ComfyUI Settings Icon](../../assets/images/comfyui/settings.png)
