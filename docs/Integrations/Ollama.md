# Ollama Integration

![Ollama Logo](../../assets/images/logos/ollama.jpg)

Ollama is an easy-to-use solution for downloading and running popular large
language models and can be downloaded from
[https://ollama.com](https://ollama.com).

## Ollama Server

There are multiple ways to run Ollama using the `ollama serve` command,
including through Docker, a systemd service, or other means. Please refer to the
[Ollama documentation](https://github.com/ollama/ollama/blob/main/README.md) to
download, configure, and install Ollama.

Once Ollama is running as a server, it's typically accessible on port `11434`
of your assigned host. If you're running Ollama on your current device, you can
most likely use `http://localhost:11434/` as the value for the
`MUSEBOT_OLLAMA_HOSTS` environment variable in your `.env` configuration file,
though make sure you specify the correct host and port if that's not the case.

```.env
...

MUSEBOT_OLLAMA_HOSTS=http://localhost:11434/

...
```

Make sure to substitute your machine's hostname or IP address instead and that
it's accessible from your Musebot instance(s).

## Models

You can browse models for Ollama at
[https://ollama.com/search](https://ollama.com/search). If you're not certain
which model is best for your use case, we recommend trying out `mistral-nemo`.
It should perform well on most hardware and is flexible enough to answer most
questions and adopt most personas. If `mistral-nemo` is still too slow, consider
using the regular `mistral` model instead.

Ollama provides a CLI for downloading these models:

```bash
ollama pull mistral-nemo
```

Once Ollama downloads your preferred model, you can specify it in your `.env`
configuration by assigning it to the `MUSEBOT_OLLAMA_MODELS` environment
variable.

## Image Attachment Support

If you also integrate Musebot with a [ComfyUI](../comfyui/index.html) or
[SwarmUI](../swarmui/index.html) instance with `MUSEBOT_FUNCTION` set to `text`,
Musebot will use the large language model response as a prompt for an image and
attach it to its response asynchronously, providing a visual for the response.

## Return

Return to the main [Musebot Documentation](../../index.html) and continue from
step 2 if you want to setup additional generative AI solutions or continue on to
step 3.
