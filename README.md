# Vyntrixo - photo sharing app (Flask)

Ye ek real working app hai: signup/login, photo upload, sab ki shared feed, like, aur apni photos delete.
Backend: Python + Flask. Database: SQLite (ek file: `instance/app.db`). Frontend: plain HTML/CSS/JS (mobile friendly).

## Folder structure

```
insta-app/
  app.py              <- backend (routes + database)
  requirements.txt    <- Flask
  static/
    index.html        <- main page
    app.js            <- frontend logic
    style.css         <- styling
    uploads/          <- user ki uploaded photos yahan save hoti hain
  instance/           <- app.db (users, photos, likes) aur secret.key (pehli run par ban jaati hain)
```

## Kaise chalana hai (run karne ke steps)

1. Python 3.9 ya usse upar install ho (check: `python3 --version`).

2. Folder mein jao:
   ```
   cd insta-app
   ```

3. Virtual environment banao (recommended):
   ```
   python3 -m venv venv
   source venv/bin/activate        # Windows: venv\Scripts\activate
   ```

4. Flask install karo:
   ```
   pip install -r requirements.txt
   ```

5. App start karo:
   ```
   python app.py
   ```

6. Browser mein kholo: http://localhost:5000

   Phone par same WiFi mein ho to apne computer ka IP use karo, jaise http://192.168.1.10:5000 (IP `ipconfig` / `ifconfig` se milega).

Port badalna ho to: `PORT=8080 python app.py`

## Kaise use karna hai

- **Sign up**: username (3-20 characters, sirf letters, numbers, _), email, password (kam se kam 6 characters).
- **Login**: email aur password.
- **+ Upload**: photo choose karo (png, jpg, jpeg, gif, webp; max 8MB), caption likho (optional), Upload dabao.
- **Feed**: sabki photos latest pehle dikhti hain. Dil (♡) dabao to like, dobara dabao to unlike.
- **Mine**: apni photos dekho aur Delete kar sakte ho.
- **Logout**: upar wale button se.

## Important notes

- Ye development ke liye hai. Internet par publicly chalana ho to `debug` band rakho (ye already band hai), aur `SECRET_KEY` environment variable mein apni random key set karo, jaise:
  ```
  export SECRET_KEY="koi-lambi-random-string"
  ```
  Bina iske app `instance/secret.key` file mein apne aap ek key bana leta hai.
- Passwords hashed (werkzeug) save hote hain, plain text nahi.
- Database reset karna ho to `instance/app.db` file delete karo (saara data chala jayega) aur app dobara start karo.
- Photos ko `static/uploads/` mein save kiya jata hai. Backup lena ho to ye folder aur `instance/app.db` copy karo.

## API (agar aage kuch banana ho)

| Method | Route | Kaam |
|---|---|---|
| POST | /api/signup | account banao |
| POST | /api/login | login |
| POST | /api/logout | logout |
| GET | /api/me | current user |
| GET | /api/feed | sab ki photos (latest 100) |
| POST | /api/photos | photo upload (multipart: photo, caption) |
| GET | /api/my-photos | meri photos |
| POST | /api/photos/<id>/like | like / unlike toggle |
| DELETE | /api/photos/<id> | apni photo delete |
