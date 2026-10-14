// CI/CD no Jenkins (https://jenkins.caioruiz.com): builda as imagens dos apps (ruiz-*/*/Dockerfile),
// publica no Docker Hub com a versão do umbrel-app.yml e atualiza as tags nos docker-compose.yml.
// As imagens são construídas no Docker isolado do app do Jenkins, pelo socket montado no agente.
pipeline {
  agent { label 'docker' }
  options {
    timestamps()
    ansiColor('xterm')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '60'))
    timeout(time: 60, unit: 'MINUTES')
  }
  stages {
    stage('Verificar commit') {
      steps {
        script {
          // commits do próprio CI (atualização de versões) não disparam outro build
          env.SKIP_CI = sh(script: "git log -1 --pretty=%B | grep -qF '[skip ci]' && echo true || echo false", returnStdout: true).trim()
          if (env.SKIP_CI == 'true') {
            currentBuild.description = 'Pulado: [skip ci]'
          }
        }
      }
    }
    stage('Build e push das imagens') {
      when { allOf { branch 'master'; environment name: 'SKIP_CI', value: 'false' } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DH_USER', passwordVariable: 'DH_TOKEN')]) {
          sh '''
            set -eu
            echo "$DH_TOKEN" | docker login -u "$DH_USER" --password-stdin
            trap 'docker logout >/dev/null 2>&1 || true' EXIT
            for df in $(find . -path './ruiz-*/*/Dockerfile' | sort); do
              dir=$(dirname "$df"); dir=${dir#./}
              app=${dir%%/*}
              image="$DH_USER/$(echo "$dir" | tr / -)"
              version=$(grep -E '^[[:space:]]*version:' "$app/umbrel-app.yml" | sed -E 's/^[[:space:]]*version:[[:space:]]*"?([^" ]+)"?/\\1/')
              echo "==> $image:$version"
              docker buildx build --push -t "$image:latest" -t "$image:$version" "$dir"
            done
          '''
        }
      }
    }
    stage('Atualizar versões nos docker-compose') {
      when { allOf { branch 'master'; environment name: 'SKIP_CI', value: 'false' } }
      steps {
        withCredentials([usernamePassword(credentialsId: 'github', usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
          sh '''
            set -eu
            for app in ruiz-*/; do
              app=${app%/}
              version=$(grep -E '^[[:space:]]*version:' "$app/umbrel-app.yml" | sed -E 's/^[[:space:]]*version:[[:space:]]*"?([^" ]+)"?/\\1/')
              # só as imagens desta loja (<namespace>/ruiz-*); imagens de terceiros ficam como estão
              sed -i -E "s|(image: [^/: ]+/ruiz-[^: ]+):([0-9]+\\.[0-9]+\\.[0-9]+)|\\1:$version|g" "$app/docker-compose.yml"
            done
            if git diff --quiet -- 'ruiz-*/docker-compose.yml'; then
              echo "Nenhuma versão para atualizar."
              exit 0
            fi
            git config user.name "Jenkins"
            git config user.email "jenkins@caioruiz.com"
            git add ruiz-*/docker-compose.yml
            git commit -q -m "chore: update docker-compose image versions [skip ci]"
            git -c credential.helper='!f() { echo username=$GH_USER; echo password=$GH_TOKEN; }; f' \
              push -q https://github.com/CaioRuizz/ruiz-app-store.git HEAD:master
            echo "Versões atualizadas e enviadas."
          '''
        }
      }
    }
  }
}
