// Umbrel: no primeiro início, a senha do usuário "admin" criado pelo assistente do Jenkins passa a ser
// a senha do app mostrada pelo Umbrel (APP_PASSWORD). Roda uma vez só; depois disso a senha é sua.
import hudson.security.HudsonPrivateSecurityRealm
import jenkins.model.Jenkins

def password = System.getenv('APP_PASSWORD')
def jenkins = Jenkins.get()
def marker = new File(jenkins.rootDir, '.umbrel-password-applied')
def realm = jenkins.securityRealm

if (password && !marker.exists() && realm instanceof HudsonPrivateSecurityRealm) {
    def admin = realm.getUser('admin')
    if (admin != null) {
        admin.addProperty(HudsonPrivateSecurityRealm.Details.fromPlainPassword(password))
        admin.save()
        new File(jenkins.rootDir, 'secrets/initialAdminPassword').text = password
        marker.text = 'ok\n'
        println 'Umbrel: senha inicial do Jenkins definida com a senha do app.'
    }
}
