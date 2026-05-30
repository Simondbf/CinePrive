# Instructions de Génération APK (CinéPrivé)

L'environnement de développement actuel (AI Studio / Cloud) ne permet pas de compiler nativement du Java/Android. J'ai donc généré pour vous la **coquille vide (Wrapper WebView)** exacte que vous avez demandée, située dans le dossier \`android-wrapper\`.

## 1. Créer le Keystore (Signature Crypto Locale)
Sur votre ordinateur, ouvrez un terminal dans le dossier \`android-wrapper/app\` et tapez la commande suivante pour créer votre signature locale gratuite :

```bash
keytool -genkey -v -keystore keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias cineprive
```
*(⚠️ Utilisez le mot de passe : \`cineprive123\` qui est déjà configuré dans le code)*

## 2. Compiler l'APK
Ensuite, pour générer le fichier \`.APK\` final (assurez-vous d'avoir Android Studio ou Gradle installé sur votre ordinateur) :

```bash
# Dans le dossier android-wrapper :
./gradlew assembleRelease
```

🎉 Votre fichier APK signé sera dans : \`android-wrapper/app/build/outputs/apk/release/app-release.apk\`

**Note** : Avant de compiler, n'oubliez pas de modifier la variable \`APP_URL\` dans le fichier \`MainActivity.java\` avec l'URL publique de votre serveur web CinéPrivé hébergé.
