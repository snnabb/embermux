package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"github.com/snnabb/embermux/internal/backend"
)

var Version = "dev"

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		log.Fatal(err)
	}
}

func run(args []string, stdout io.Writer) error {
	flags := flag.NewFlagSet("embermux", flag.ContinueOnError)
	flags.SetOutput(io.Discard)

	showVersion := flags.Bool("version", false, "print version")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() > 0 {
		return fmt.Errorf("unexpected arguments: %s", strings.Join(flags.Args(), " "))
	}
	if *showVersion {
		_, err := fmt.Fprintf(stdout, "EmberMux %s\n", Version)
		return err
	}

	app, err := backend.NewApp()
	if err != nil {
		return err
	}
	defer app.Close()

	return app.Run()
}
