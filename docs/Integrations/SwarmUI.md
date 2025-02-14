# SwarmUI Integration

![SwarmUI Logo](../../assets/images/logos/swarmui.jpg)

[SwarmUI](https://github.com/mcmonkeyprojects/SwarmUI) is a media studio
application for image, video, and other multimedia generation. It primarily acts
as a beginner-friendly wrapper for
[ComfyUI](https://github.com/comfyanonymous/ComfyUI).

ComfyUI performs most of the actual work for SwarmUI and is a complex node-based
workflow editor for the aforementioned multimedia and corresponding generative
AI models.

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

1. Navigate to the SwarmUI URL in your preferred web browser. If this is
   localhost for you, this is most likely available on the default port:
   [http://localhost:7801](http://localhost:7801)
2. Locate the `Comfy Workflow` tab in SwarmUI and navigate using it:

   ![Comfy Workflow Tab](../../assets/images/swarmui/comfy-workflow-tab.png)
3. Look for the large gear icon in the bottom left of ComfyUI.

   ![ComfyUI Settings Icon](../../assets/images/comfyui/settings.png)
4. Enable `Dev Mode` in the settings modal:

   ![ComfyUI Settings Modal](../../assets/images/comfyui/settings-modal.png)

## 3. Connect SwarmUI to Musebot

In your `.env` configuration file, set the `MUSEBOT_STABLE_DIFFUSION_HOSTS` to
your ComfyUI backend included as part of Swarm UI. If your SwarmUI instance is
running on `localhost`, this setting will generally look like:

```.env
...

MUSEBOT_STABLE_DIFFUSION_HOSTS=http://localhost:7801/ComfyBackendDirect

...
```

Make sure to substitute your machine's hostname or IP address instead and that
it's accessible from your Musebot instance(s).

## 4. Musebot Workflow Templates

ComfyUI uses processing pipelines known as _workflows_. They contain a list
of instructions used to generate the output media (usually, but not limited to,
an image) at the end of the pipeline.

Confusingly, ComfyUI supports two different types of workflows, and both can
be exported. This is why we needed to enable `Dev Mode` in ComfyUI.

Musebot utilizes _API workflows_ with a few modifications after export. This is
what the `./workflows` directory/mount point (depending on your Musebot
configuration) is included for with Musebot.

### Exporting a ComfyUI API Workflow

1. Navigate to the `Comfy Workflow` tab in SwarmUI:

   ![Comfy Workflow Tab](../../assets/images/swarmui/comfy-workflow-tab.png)
2. Load or create a workflow in ComfyUI. If you've successfully generated an
   image or other piece of media using the `Generate` tab, SwarmUI contains
   an extremely useful `Import From Generate Tab` button that will automatically
   build a ComfyUI workflow for you based on your last render:

   ![SwarmUI Import From Generate Tab](../../assets/images/swarmui/import-button.png)

3. Find the `Workflow` menu in the Comfy UI user interface:

   ![ComfyUI Workflow Menu](../../assets/images/comfyui/workflow-menu.png)
4. Select the `Export (API)` menu item:

   ![ComfyUI Workflow Menu Items](../../assets/images/comfyui/workflow-menu-items.png)

   You will then name the workflow and will be asked to save it. Navigate to
   Musebot's workflow directory and save your workflow in the correct directory
   based on what type of workflow you've built.
5. Fill in any applicable defaults for in the workflow templates. More on this
   is documented in the "Musebot Defaults" section of this documentation.

   Musebot is also distributed with some example workflows to help get you
   started.

   **Note:** _You may need to design your workflows around Musebot's limitations._

### Types of Workflows

Musebot supports a limited number of specific workflow types and each are mapped
to matching directories within `./workflows`:

* `img2img`: These workflows accept a base64 encoded image and process the image
   into another image. Support is still being developed for these kinds of
   workflows, so stay tuned!
* `img2img/upscalers`: Like other `img2img` workflows, these workflows accept
   a base64 string, but are fully supported. In fact, two workflows of this type
   are currently **required**. When it comes to the Musebot Defaults (see the
   section below), the `$musebotDefaults.prompt` property is used as the
   base64-encoded image.

  * `img2img/upscalers/design.json`: Used for upscaling design-based images with
     a low number of colors and/or simple contours and shapes. The provided
     example workflow requires the `RealESRGAN_x4plus_anime_6B.pth` upscaling
     model which can be downloaded from
     [GitHub](https://github.com/xinntao/Real-ESRGAN/releases/download/latest/RealESRGAN_x4plus_anime_6B.pth).

     The model should be downloaded to `SwarmUI/Models/upscale_models`.
  * `img2img/upscalers/detail.json`: Used for upscaling detailed or realistic
     images featuring a lot of complex detail. This requires the
     `RealESRGAN_x4plus.pth` upscaling model which can be downloaded from
     [GitHub](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth).

     The model should be downloaded to `SwarmUI/Models/upscale_models`.
* `txt2img`: These workflows accept a text prompt and return one or several
   images. If you provide multiple workflows in this directory, Musebot will
   choose a random one.
* `txt2vid`: These workflows accept a text prompt and return a video. Videos
   should be exported as animated WebP images or GIF images, though beware of
   Discord's upload size limits. WebP is probably the more size-conscious
   choice. Of course, The upload size limits do apply to the other workflow
   types as well, but you are more likely to run into them with video output. If
   you provide multiple workflows in this directory, Musebot will choose a
   random one.

**Note:** _Musebot reloads all workflows before each task, so you don't need to
restart Musebot when modifying workflows._

### Musebot Defaults

In order for Musebot to control various aspects of each workflow, it makes use
of the [Mustache template language](https://mustache.github.io/). Don't worry!
Musebot's implementation is very basic, and you shouldn't need to reference the
Mustache documentation very much, if at all.

1. Understand the API workflows exported by ComfyUI are JSON files. JSON is a
   plaintext format used to exchange data in a standard way between various
   systems and represent a hierarchy of concepts called an _object_, but you
   won't really need to worry about that too much.

   Once you open the workflow in your favorite text editor, you'll probably
   understand some of the concepts and syntax intuitively if you're not already
   familiar.

   **Note:** _Ensure that you open the workflow in a **text** editor. Word
   processors such as Microsoft Word are not sufficient to edit these files._
2. Each workflow file should begin with a curly brace: `{`. This represents the
   beginning of a JSON object. We need to define two different things in each
   workflow file to turn them into templates:

   1. A new child object within the workflow object that defines defaults for
      Musebot to read for each workflow
   2. Mustache template placeholders so Musebot can insert those values in the
      appropriate place in each workflow

   This is easy once understood, but can be daunting your first time. Please
   refer to the example workflows provided as they illustrate these concepts
   concretely. Feel free to even _use_ the provided templates as-is provided you
   use the same models and place your models in the correct filesystem location
   as dictated by the templates - or edit the model file paths in the workflow
   to match models you have already downloaded and placed in the appropriate
   location for SwarmUI. Please refer to the SwarmUI documentation for model
   installation.

#### Defaults Object

The Musebot defaults object should be placed within the root (top) level pair
of curly braces, preferably at the top of the file. (Though technically this
doesn't matter.)

This should look something like:

```json
{
  "$musebotDefaults": {
    "prompt": "",
    "promptNegative": "",
    "model": "",
    "seed": -1,
    "width": 1024,
    "height": 1024,
    "sampler": "dpmpp_sde",
    "scheduler": "karras",
    "cfgScale": 2,
    "steps": 8,
    "num": 1
  },
  // The ComfyUI workflow nodes should begin here.
}
```

* `prompt`: The prompt given to the model that instructs it what to create. As
   mentioned earlier, this is used for the base64 encoded images in all
   `img2img` workflows, including the `img2img/upscalers`.
* `promptNegative`: The negative prompt used to "remove" things from the model
   output - not required.
* `model`: The model being used, though most workflows will have this value
   hardcoded. Feel free to leave this blank is in the above example.
* `seed`: A number used for randomization in the model - `-1` can be used as a
   placeholder, but this is always overridden by Musebot at this time.
* `width`: The resolution of any graphical output - this is usually dependent on
   the model being used.
* `height`: The resolution of any graphical output - this is usually dependent
   on the model being used.
* `sampler`: The sampler algorithm that should be used - feel free to experiment
   with available samplers in ComfyUI for best results. Some models may
   recommend particular samplers.
* `scheduler`: The scheduler algorithm that should be used - feel free to
   experiment with available schedulers in ComfyUI for best results. Some models
   may recommend particular schedulers.
* `cfgScale`: This is generally how strictly the selected model follows the text
   prompt. Some models may recommend a specific CFG scale.
* `steps`: This is how many iterations the models should sample its output. Some
   models may recommend a particular number of steps.
* `num`: This is how many images or videos to output at a time. Consider your
   hardware's average processing time before doing more than one output at a
   time.

#### Template Placeholders

Each default property documented above can be referenced in the workflow
template. Each property should be wrapped in quotes and triple curly brackets,
even if it's numeric. Let's look at two examples:

##### An Input Text Prompt

```json
{
   // ...
   "6": {
    "inputs": {
      "text": "{{{ prompt }}}",
      "clip": [
        "4",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Prompt)"
    }
  },
  // ...
}
```

##### Sampler Settings

```json
{
   // ...
   "10": {
    "inputs": {
      "noise_seed": "{{{ seed }}}",
      "steps": "{{{ steps }}}",
      "cfg": "{{{ cfgScale }}}",
      "sampler_name": "{{{ sampler }}}",
      "scheduler": "{{{ scheduler }}}",
      "start_at_step": 0,
      "end_at_step": 10000,
      "var_seed": 0,
      "var_seed_strength": 0,
      "sigma_max": -1,
      "sigma_min": -1,
      "rho": 7,
      "add_noise": "enable",
      "return_with_leftover_noise": "disable",
      "previews": "default",
      "tile_sample": false,
      "tile_size": 1024,
      "model": [
        "4",
        0
      ],
      "positive": [
        "6",
        0
      ],
      "negative": [
        "100",
        0
      ],
      "latent_image": [
        "5",
        0
      ]
    },
    "class_type": "SwarmKSampler",
    "_meta": {
      "title": "SwarmKSampler"
    }
  },
  // ...
}
```

## Return

Return to the main [Musebot Documentation](../../index.html) and continue from
step 2 if you want to setup additional generative AI solutions or continue on to
step 3.
