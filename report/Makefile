# Build the report with latexmk (handles biber and reruns automatically).
MAIN = main

.PHONY: all clean watch

all:
	latexmk -pdf -interaction=nonstopmode -halt-on-error $(MAIN).tex

watch:
	latexmk -pdf -pvc -interaction=nonstopmode $(MAIN).tex

clean:
	latexmk -C
