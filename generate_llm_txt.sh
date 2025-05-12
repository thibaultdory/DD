#!/bin/bash

# Script to generate llm.txt file with code content from the repository
# This script will:
# - Find important code files in the repository
# - Add each file's content to llm.txt with clear separators
# - Include paths and filenames

# Output file
OUTPUT_FILE="llm.txt"

# Clear the output file if it exists
> "$OUTPUT_FILE"

# Function to add a file to the output
add_file_to_output() {
    local file=$1
    
    # Skip if file doesn't exist
    if [ ! -f "$file" ]; then
        return
    fi
    
    # Skip if file is empty
    if [ ! -s "$file" ]; then
        return
    fi
    
    # Add separator and file information
    echo "================================================================================" >> "$OUTPUT_FILE"
    echo "FILE: $file" >> "$OUTPUT_FILE"
    echo "================================================================================" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    # Add file content
    cat "$file" >> "$OUTPUT_FILE"
    
    # Add newline after file content
    echo "" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
}

# First, include the README.md file
add_file_to_output "./README.md"

# Include key files that are essential to understanding the application
IMPORTANT_FILES=(
    "./backend/app/main.py"
    "./backend/app/api/api.py"
    "./backend/app/models/user.py"
    "./backend/app/models/family.py"
    "./backend/app/models/task.py"
    "./backend/app/models/privilege.py"
    "./backend/app/schemas/user.py"
    "./backend/app/schemas/family.py"
    "./backend/app/schemas/task.py"
    "./backend/app/schemas/privilege.py"
    "./frontend/src/App.tsx"
    "./frontend/src/pages/Dashboard.tsx"
    "./frontend/src/pages/Calendar.tsx"
    "./frontend/src/components/TaskList.tsx"
    "./frontend/src/components/PrivilegeList.tsx"
)

# Add important files first
for file in "${IMPORTANT_FILES[@]}"; do
    add_file_to_output "$file"
done

# Find important code files, focusing on Python, JavaScript, TypeScript, and other core code files
# Exclude documentation, tests, and less important configuration files
find ./backend ./frontend -type f \
    -not -path "*/\.*" \
    -not -path "*/node_modules/*" \
    -not -path "*/venv/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/docs/*" \
    -not -path "*/tests/*" \
    -not -path "*/test/*" \
    -not -path "*/\__pycache__/*" \
    -not -path "*/migrations/*" \
    -not -path "*/types/*" \
    -not -path "*/utils/*" \
    -not -path "*/helpers/*" \
    -not -path "*/constants/*" \
    -not -name "*.pyc" \
    -not -name "*.jpg" \
    -not -name "*.jpeg" \
    -not -name "*.png" \
    -not -name "*.gif" \
    -not -name "*.pdf" \
    -not -name "*.zip" \
    -not -name "*.tar" \
    -not -name "*.gz" \
    -not -name "*.mp3" \
    -not -name "*.mp4" \
    -not -name "*.avi" \
    -not -name "*.mov" \
    -not -name "*.md" \
    -not -name "*.svg" \
    -not -name "*.ico" \
    -not -name "*.lock" \
    -not -name "package-lock.json" \
    -not -name "*.config.*" \
    -not -name "*.d.ts" \
    | grep -E '\.(py|js|jsx|ts|tsx|vue|sql|html|css|scss)$' \
    | grep -v -E '(test|spec|mock|stub|fixture|config|setup|init)\.([^.]+)$' \
    | sort | while read -r file; do
    
    # Skip files that are likely to be less important
    if [[ "$file" == *"/__init__.py" ]] || [[ "$file" == *"/settings.py" ]] || [[ "$file" == *"/config.py" ]]; then
        continue
    fi
    
    # Skip if file is a directory
    if [ -d "$file" ]; then
        continue
    fi
    
    # Skip if file is empty
    if [ ! -s "$file" ]; then
        continue
    fi
    
    # Skip if file is already in the IMPORTANT_FILES list
    skip=0
    for important_file in "${IMPORTANT_FILES[@]}"; do
        if [[ "$file" == "$important_file" ]]; then
            skip=1
            break
        fi
    done
    
    if [[ $skip -eq 1 ]]; then
        continue
    fi
    
    # Add file to output
    add_file_to_output "$file"
done

echo "Generated $OUTPUT_FILE with code content from the repository."