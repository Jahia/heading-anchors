# End-to-end tests

Cypress tests of the module against a real Jahia, run in Docker with the
[`@jahia/cypress`](https://github.com/Jahia/jahia-cypress) harness. The provisioning imports the Digitall demo site,
then installs the module built in `../target`. The spec `cypress/e2e/01-headingAnchors.cy.ts` creates a test page
under the Digitall home page, changes the module configuration through the provisioning API, and checks the
rendered pages in preview and live (ids, permalink button, toast, translations, WCAG 2.2 AA with axe-core, isolation
from the site styles).

## Prerequisites

- Docker, with about 10 GB of free disk space for the images
- the module built: `mvn clean install` in the parent folder
- a Jahia license, base64-encoded

## Environment

`set-env.sh` loads **either** `tests/.env` **or** `tests/.env.example`, never both. To run the tests locally, create
`tests/.env` (git-ignored) with all the variables of `.env.example` and your license:

```bash
sed '/^JAHIA_LICENSE=/d' .env.example > .env && echo "JAHIA_LICENSE=$(base64 -i /path/to/license.xml | tr -d '\n')" >> .env
```

| Variable | Description |
|---|---|
| `JAHIA_IMAGE` | Jahia image, e.g. `ghcr.io/jahia/jahia-ee-dev:8.2.3.2` |
| `TESTS_IMAGE` | Name of the local Cypress image built by `ci.build.sh` (`jahia/heading-anchors:latest`) |
| `MODULE_ID` | Module checked before running the tests (`heading-anchors`) |
| `JAHIA_LICENSE` | Jahia license, base64-encoded |
| `SUPER_USER_PASSWORD` | Password of the `root` user of the test Jahia |

## Run everything in Docker

The same process as a CI run: Jahia starts, the environment is provisioned, then the tests run.

```bash
bash ci.build.sh
bash ci.startup.sh
```

`ci.build.sh` builds the test image and copies the module jar: run it again after any change in `tests/` or in the
module. Results (mochawesome and JUnit reports, screenshots of failures, videos of failed specs) are in `results/`.

## Rerun the spec against the running Jahia

After a first `ci.startup.sh`, Jahia keeps running. To test a new build of the module without restarting:

```bash
source ./set-env.sh
printf -- "- installBundle: 'heading-anchors-1.0.0-SNAPSHOT.jar'\n  autoStart: true\n  uninstallPreviousVersion: true\n" > /tmp/install.yml
curl -u "root:$SUPER_USER_PASSWORD" -X POST http://localhost:8080/modules/api/provisioning \
  -F "script=@/tmp/install.yml;type=application/yaml" -F "file=@../target/heading-anchors-1.0.0-SNAPSHOT.jar"
docker run --rm --network tests_stack -e CYPRESS_BASE_URL=http://jahia:8080 -e JAHIA_URL=http://jahia:8080 \
  -e SUPER_USER_PASSWORD -v "$PWD/cypress:/home/jahians/cypress" -v "$PWD/results:/home/jahians/results" \
  "$TESTS_IMAGE" yarn e2e:ci --spec cypress/e2e/01-headingAnchors.cy.ts
```

Lint the specs with `docker run --rm -v "$PWD/cypress:/home/jahians/cypress" "$TESTS_IMAGE" yarn lint`.

Stop the stack with `docker compose down`.
