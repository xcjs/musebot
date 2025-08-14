#!/bin/bash
echo "Starting automated Ollama-based code review..."

echo Starting Ollama server...
ollama serve > /dev/null 2>&1 &

reviewModel="gemma3:12b-it-qat"
reviewModel="qwen2.5-coder:latest"
reviewModel="gemma3n:latest"
reviewModel="gemma3:1b-it-qat"

echo "Removing node_modules to avoid them being reviewed."
rm -r node_modules/

filesToReview=$(find . -name "*.ts" || true)
echo "Reviewing the following files:"
echo ""
echo ""
echo "${filesToReview}"

# Exit early if no TypeScript files are found.
if [ -z "${filesToReview}" ]; then
    echo "No eligible files were ready for review."
    exit 0
fi

reviewReport="Code Review.md"
echo "Creating ${reviewReport}"
echo "# Code Review Report" > "${reviewReport}"

echo "" >> "${reviewReport}"
echo "" >> "${reviewReport}"

for file in ${filesToReview}; do
    echo "Reviewing ${file}"

    prompt="Review the following code from '${file}', provide suggestions for improvement, coding best practices, improve readability, and maintainability. Remove any code smells and anti-patterns. Provide code examples for your suggestion. If the file does not have any code or does not need any changes, say 'No changes needed.'"
    content=$(cat "${file}")

    review=$(ollama run "${reviewModel}" "${prompt}" "${content}")

    echo "## ${file}" >> "${reviewReport}"
    echo "" >> "${reviewReport}"
    echo "" >> "${reviewReport}"

    echo "${review}" >> "${reviewReport}"
    echo "" >> "${reviewReport}"
    echo "" >> "${reviewReport}"
done

echo ""
