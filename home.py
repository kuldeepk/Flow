#!/usr/bin/env python
#
# Copyright 2009 Facebook
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may
# not use this file except in compliance with the License. You may obtain
# a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
# License for the specific language governing permissions and limitations
# under the License.

import logging
import tornado.auth
import tornado.httpserver
import tornado.ioloop
import tornado.options
import tornado.web
import os.path

from tornado.options import define, options

define("port", default=8888, help="run on the given port", type=int)

class BaseHandler(tornado.web.RequestHandler):
    def get_current_user(self):
        return self.get_secure_cookie("user")
    
class MainHandler(BaseHandler):
    @tornado.web.authenticated
    def get(self):
        self.render("home.html")

class LoginHandler(BaseHandler):
    def get(self):
        self.write('<html><body><form action="/login" method="post">'
                   'Name: <input type="text" name="name">'
                   '<input type="submit" value="Sign in">'
                   '</form></body></html>')

    def post(self):
        self.set_secure_cookie("user", self.get_argument("name"))
        self.redirect("/")

class LogoutHandler(BaseHandler):
    def get(self):
        self.clear_cookie("user")
        self.redirect("/login")
                
class TaskMixin(object):
    waiters = []

    def wait_for_updates(self, callback):
        cls = TaskMixin
        cls.waiters.append({'callback':callback, 'user': self.get_secure_cookie("user")})

    def new_task(self, task_id, after_task, step, task_text=None):
        cls = TaskMixin
        for index in range(len(cls.waiters)):
            try:
                logging.info("Sender: %s , Waiter: %s", self.get_secure_cookie("user"), cls.waiters[index]['user'])
                if self.get_secure_cookie("user") != cls.waiters[index]['user']:
                    cls.waiters[index]['callback']('new_task', task_id, task_text, after_task, step)
                    cls.waiters.pop(index)
            except:
                logging.error("Error in waiter callback", exc_info=True)
        #cls.waiters = []
    
    def update_task(self, task_id, task_text=None):
        cls = TaskMixin
        for index in range(len(cls.waiters)):
            try:
                logging.info("Sender: %s , Waiter: %s", self.get_secure_cookie("user"), cls.waiters[index]['user'])
                if self.get_secure_cookie("user") != cls.waiters[index]['user']:
                    cls.waiters[index]['callback']('update_task', task_id, task_text)
                    cls.waiters.pop(index)
            except:
                logging.error("Error in waiter callback", exc_info=True)
    
    def delete_task(self, task_id):
        cls = TaskMixin
        for index in range(len(cls.waiters)):
            try:
                logging.info("Sender: %s , Waiter: %s", self.get_secure_cookie("user"), cls.waiters[index]['user'])
                if self.get_secure_cookie("user") != cls.waiters[index]['user']:
                    cls.waiters[index]['callback']('delete_task', task_id, "")
                    cls.waiters.pop(index)
            except:
                logging.error("Error in waiter callback", exc_info=True)
                
    def shift_task(self, task_id, shift_to):
        cls = TaskMixin
        for index in range(len(cls.waiters)):
            try:
                logging.info("Sender: %s , Waiter: %s", self.get_secure_cookie("user"), cls.waiters[index]['user'])
                if self.get_secure_cookie("user") != cls.waiters[index]['user']:
                    cls.waiters[index]['callback']('shift_task', task_id, None, None, None, shift_to)
                    cls.waiters.pop(index)
            except:
                logging.error("Error in waiter callback", exc_info=True)
            
class TaskUpdatesHandler(BaseHandler, TaskMixin):
    @tornado.web.authenticated
    @tornado.web.asynchronous
    def post(self):
        self.wait_for_updates(self.async_callback(self.on_update))

    def on_update(self, action, task_id, task_text=None, after_task=None, step=None, shift_to=None):
        # Closed client connection
        if self.request.connection.stream.closed():
            return
        self.finish(dict(task_id=task_id, task_text=task_text, action=action, after_task=after_task, step=step, shift_to=shift_to))

class TaskNewHandler(BaseHandler, TaskMixin):
    @tornado.web.authenticated
    def post(self):
        self.new_task(self.get_argument("taskid"), self.get_argument("after_task"), self.get_argument("step"), self.get_argument("body", ""))
        
class TaskUpdateHandler(BaseHandler, TaskMixin):
    @tornado.web.authenticated
    def post(self):
        self.update_task(self.get_argument("taskid"), self.get_argument("body", ""))

class TaskDeleteHandler(BaseHandler, TaskMixin):
    @tornado.web.authenticated
    def post(self):
        self.delete_task(self.get_argument("taskid"))

class TaskShiftHandler(BaseHandler, TaskMixin):
    @tornado.web.authenticated
    def post(self):
        self.shift_task(self.get_argument("taskid"), self.get_argument("shift_to"))
                
def main():
    tornado.options.parse_command_line()
    handlers = [
        (r"/", MainHandler),
        (r"/login", LoginHandler),
        (r"/logout", LogoutHandler),
        (r"/task/updates", TaskUpdatesHandler),
        (r"/task/new", TaskNewHandler),
        (r"/task/update", TaskUpdateHandler),
        (r"/task/delete", TaskDeleteHandler),
        (r"/task/shift", TaskShiftHandler),
    ]
    settings = dict(
            template_path=os.path.join(os.path.dirname(__file__), "templates"),
            static_path=os.path.join(os.path.dirname(__file__), "static"),
            login_url="/login",
            cookie_secret="61oETzKXQAGaYdkL5gEmGeJJFuYh7EQnp2XdTP1o/Vo=",
    )
    application = tornado.web.Application(handlers, **settings)
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(options.port)
    tornado.ioloop.IOLoop.instance().start()


if __name__ == "__main__":
    main()
