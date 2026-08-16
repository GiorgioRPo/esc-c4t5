#!/bin/bash
export LC_ALL=C.UTF-8
export LANG=C.UTF-8
exec st run openapi.json --url http://localhost:3001 --exclude-checks not_a_server_error,unsupported_method "$@"
