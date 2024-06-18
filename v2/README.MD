# Short cheatsheet for icons generation
In order to generate icons font from SVG we are using:
```npm install -g fantasticon```
## Icons generation
Navigate to v2 directory and execute:
```fantasticon -n r4m-table-icons -p r4m-t-icon -o icons/fonts icons/svg --tag= --normalize --asset-types css```
where the args are:
n - font-family name
p - icons class prefix
o - dest folder
and the last arg - dist folder
