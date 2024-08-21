# Unofficial ICLoud drive cloud built on icloud.com/drive API

## Overview

This is a client for ICloud Drive built on the top of non public API. It tries to
make as less API requests as possible by using cache.

## TODO:
- verify extension before uploading to APP_LIBRARY
- upload multiple files
- download file
- download folder
- upload folder

- overwrighting upload
- TRASH

## Usage
```Commands:
  cli-drive.js ls [paths..]                 list files in a folder
  cli-drive.js mkdir <path>                 mkdir
  cli-drive.js rm [paths..]                 remove
  cli-drive.js cat <path>                   cat
  cli-drive.js mv <srcpath> <dstpath>       move
  cli-drive.js upload <srcpath> <dstpath>   upload
  cli-drive.js uploads <uploadsargs..>      uploads
  cli-drive.js autocomplete <path>          autocomplete
  cli-drive.js download <path> <dstpath>    download
  cli-drive.js df <path> <dstpath>          df
  cli-drive.js uf <localpath> <remotepath>  uf
  cli-drive.js init                         init
  cli-drive.js edit <path>                  edit

Options:
      --version                 Show version number                    [boolean]
  -s, --sessionFile, --session               [default: "data/last-session.json"]
  -c, --cacheFile, --cache                [default: "data/cli-drive-cache.json"]
  -n, --noCache                                       [boolean] [default: false]
  -r, --raw                                           [boolean] [default: false]
  -d, --debug                                         [boolean] [default: false]
  -u, --update                                        [boolean] [default: false]
      --help                    Show help                              [boolean]
```
FIXMEFIXMEFIXMEFIXMEFIXMEFIXMEFIXMEFIXME
### init

Initializes new session. 

`idrive init`

`idrive init -s myicloud.json`

Do not login, just create the session file.

`idrive init --skipLogin`


### ls

List files in folders. Supports globs

`idrive ls '/Obsidian/my1/'`

`idrive ls '/Obsidian/my1/*.md'`

Use recursive flag for the globstar pattern (may take some time to process deep trees)

`idrive ls -R '/Obsidian/my1/**/*.md'`

Limit the depth of recursion

`idrive ls -R --depth 2 '/Obsidian/my1/**/*.md'`

Multiple paths

`idrive ls /Obsidian/ '/Camera/*.jpg' /Pages/Стильный\ отчет.pages`

Output result as a tree

`idrive ls -R --depth 2 --tree '/Obsidian/my1/'`


<!-- `idrive ls -R --cached`

??? -->

list trash

`idrive ls -t`

???

`idrive ls -t -R`

### rm [paths..]

Removes files and folders. Supports globs. By default moves files to the trash

Multiple paths

`idrive rm '/Obsidian/my1/*.md' /Camera/IMG_0198.jpg`

Use recursion flag for the globstar pattern

`idrive rm -R '/Obsidian/my1/**/*.md'`

Use `--dry` flag to check what is going to be removed

`idrive rm -R '/Obsidian/my1/**/*.md' --dry`

`idrive ls -R --depth 2 '/Obsidian/my1/**/*.md'`

???

Delete file skipping trash

`idrive rm --skipTrash /Camera/IMG_0198.jpg`

Do not ask for the confirmation

`idrive rm --force /Camera/IMG_0198.jpg`


### cat <path>

View the content of a text file

`idrive cat '/Obsidian/my1/note.md'`

### mv <srcpath> <dstpath>

Move or rename a file or a folder. You cannot move between different zones (e.g. between APP_LIBRARIES and Docws)

Remote file will be renamed

`idrive mv /Obsidian/my1/note1.md /Obsidian/my1/note2.md`

Remote file will be moved and renamed

`idrive mv /Obsidian/my1/note1.md /Obsidian/old/note2.md`

???

`idrive mv --force /Obsidian/my1/note1.md /Obsidian/my1/note2.md`


### mkdir <path>

Creates a folder

### edit

### upload 

Upload a single file
`idrive upload ~/Documents/note1.md /Obsidian/my1/notes/`
`idrive upload ~/Documents/note1.md /Obsidian/my1/notes/different_name.md`

Upload multiple files
`idrive upload ~/Documents/note1.md ~/Documents/note2.md ~/Documents/note3.md /Obsidian/my1/notes/`

Upload a folder
`idrive upload -R ~/Documents/ /Obsidian/my1/notes/`

Upload a folder 
`idrive upload -R '~/Documents/**/*.md' /Obsidian/my1/notes/`

<!-- 
### uploads [files..] <dstpath>

Upload multiple files to a folder

`idrive uploads note1.md note2.md /Obsidian/`
`idrive uploads *.md /Obsidian/`

`idrive uploads --overwright *.md /Obsidian/`

Upload overwrighting files without asking for confirmation. Overwritten files are moved to the trash

`idrive uploads --skipTrash *.md /Obsidian/`

Delete overwritten files skipping trash

### upload <srcfile> <dstpath>

Upload single file

`idrive note1.md /Obsidian/`

Keeping the filename

`idrive note1.md /Obsidian/newnote1.md`

Use a different filename

### uf <localpath> <remotepath>

Upload a folder. This action doesn't support uploading folder over another folder overwrigting files. It always uploads folder as a new one.

`idrive uf ./node-icloud-drive-client /Documents/projects/`

`idrive uf --include '/**/*.ts' --exclude '/**/cli-drive/**/*' ./node-icloud-drive-client  /Documents/projects/`

Upload a folder node-icloud-drive-client excluding files in cli-drive folder

`idrive uf --include '/**/*.ts' --exclude '/**/cli-drive/**/*' ./node-icloud-drive-client /Documents/projects/ --dry`


Use `dry` flag to only check what is going to be uploaded -->

### download <remotepath> <localpath>

Download a file or a folder content.

A single file

`idrive download '/Obsidian/my1/note1.md' ./outputdir`

Recursively download folders shallow content into `./outputdir/my1/`

`idrive download '/Obsidian/my1/*.md' ./outputdir`

Recursively download all `md` files into `./outputdir/diary/` 

`idrive download -R '/Obsidian/my1/' ./outputdir`

Download download all into `./outputdir/Obsidian/my1/diary/`

`idrive download -R '/Obsidian/my1/diary/**/*.md' ./outputdir`

`idrive download -RS '/Obsidian/my1/diary/**/*.md' ./outputdir`

Use `dry` flag to only check what is going to be downloaded

` include` and `exclude` flags are also supported

### recover

### autocomplete <path>

Autocomplete path. Used for shell autocompletions.

