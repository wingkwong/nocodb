#!/usr/bin/env bats

NOCO_HOME="${HOME}/.nocodb"
export NOCO_HOME

WORKING_DIR="$(pwd)"

setup() {
  cd "${WORKING_DIR}" || exit 1
  ./setup.sh
}

teardown() {
  cd "${WORKING_DIR}" || exit 1
  ./setup.sh
}

@test "Check WatchTower is enabled when specified" {
    ../expects/install/watchtower.sh

    cd "${NOCO_HOME}"

    # Check Docker Compose file to verify WatchTower configuration
    grep -q 'watchtower' docker-compose.yml

    # Verify WatchTower container is running
    docker compose ps | grep -q 'watchtower'
}
