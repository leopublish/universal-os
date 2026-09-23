# Universal OS shell defaults
if command -v fastfetch >/dev/null 2>&1; then
    alias fastfetch='fastfetch -c /usr/share/universal/fastfetch.jsonc'
    alias neofetch='fastfetch -c /usr/share/universal/fastfetch.jsonc'
fi
