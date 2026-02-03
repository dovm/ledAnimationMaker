sed -i -e 's/\r$//' $1
sudo chmod 755 $1
rm /etc/init.d/$1
cp service /lib/systemd/system/$1.service
sudo systemctl daemon-reload
sudo systemctl enable $1.service