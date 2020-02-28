# VSCode Therion Language

Tools for the Therion cave surveying programme in VS Code.

# Features

- Name completion
- Syntax Highlighting
- Formatting
- Useful commands and context menu items

## Commands

- `Therion: Create scrap template`  
  Create a new scrap from the current `.th` file complete with stations and centreline, ready for drawing
- `Therion: Compile`  
  Compile the current `.thconfig` file
- `Therion: Watch`  
  Compile the current `.thconfig` file and recompile if there are changes to it or any nested input or source

## Menu items

- `Open in Inkscape`  
  Available when opening the context menu on a `.th2` in the file explore. Opens the file in Inkscape.

## Code Completion

**Map and Scrap names**

When typing in a Therion file you will get autocomplete suggestions for map and scrap names that are accessible in that file (i.e. can be found by following the chain of `input` commands). 

**Survey names**

If you type an `@` character you will get autocomplete suggestions for survey names that are accessible in that file (i.e. can be found by following the chain of `input` commands). 

**Scoping**

The names of maps/scraps/surveys will be properly scoped so you will get the full survey path relative to where you are typing. Example:

`my_passage.th`
```
survey my_passage
  input "scraps.th"

  map my_passage_map
      m[
        suggestion: my_scrap
      ]
  endmap
ensurvey
```

`my_cave.th`
```
survey my_cave
  input "my_passage"

  map my_cave_map
    m[
      suggestion: my_passage_map@my_passage
     ]
  endmap

endsurvey
```
`my_system.th`
```
survey my_system
  input "my_cave"

  map my_system_map
     m[
       suggestion: my_cave_map@my_cave
       suggestion: my_passage_map@my_passage_map.my_cave
      ]
  endmap

  equate 1@[
            suggestion: 1@my_passage.my_cave
           ]

endsurvey
```