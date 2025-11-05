"use strict";

const self = {};
const supabase = require("./db");
const sendEmail = require("../utils/emails");
const config = require("../config");
const sgMail = require("@sendgrid/mail");
const _ = require("lodash");

const EMAIL_USER = "gerardfil.dev@gmail.com";
const SUBJECT = "Invitacion a la plataforma de gerardfil";

self.getUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .is("deleted_at", null);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getUserById = async (req, res) => {
  const user_id = req.params.user_id;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(_.first(data));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getUserByUsername = async (req, res) => {
  const search = req.params.username;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .is("deleted_at", null)
      .ilike("username", `%${search}%`);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getUserByEmail = async (req, res) => {
  const search = req.params.email;
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .is("deleted_at", null)
      .ilike("email", `%${search}%`);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.login = async (req, res) => {
  const usernameOrEmail = req.body.username;
  const password = req.body.password;
  try {
    // Buscar usuario por username O email
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .or(`username.eq.${usernameOrEmail},email.eq.${usernameOrEmail}`)
      .eq("password", password)
      .is("deleted_at", null);

    if (!user || user.length === 0) {
      throw new Error("User not found");
    }

    res.json(_.first(user));
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
};

self.createUser = async (req, res) => {
  try {
    const user = {
      name: req.body.name,
      last_name: req.body.last_name,
      username: req.body.username,
      password: req.body.password,
      email: req.body.email,
      picture: req.body.picture || "",
      type: req.body.type,
    };

    const { data: newUser, error } = await supabase
      .from("users")
      .insert(user)
      .select()
      .single();

    const inviteLink = `${config.baseUrl}invite?inviteId=${newUser.id}`;

    const html =
      '<div className="flex text-sm w-full px-4"><div className="w-full py-4 flex flex-col justify-start"><p className="p-2">Bienvenid@ ' +
      req.body.name +
      '!</p><p className="p-2">Habilita tu usuario haciendo <a href="' +
      inviteLink +
      '">click aqui</a></p></div></div>';

    await sendEmail(user.email, html);

    return res.json(newUser);
  } catch (e) {
    console.log("User creation error", e.message);
    return res.json(e);
  }
};

self.getUserByIdAndUpdate = async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const update = req.body;
    const { data: updatedUser, error } = await supabase
      .from("users")
      .update(update)
      .eq("id", user_id)
      .is("deleted_at", null);

    res.json(updatedUser);
  } catch (e) {
    console.error("delete user by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteUserById = async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const update = { deleted_at: new Date() };
    const { data: updatedUser, error } = await supabase
      .from("users")
      .update(update)
      .eq("id", user_id);

    res.json(updatedUser);
  } catch (e) {
    console.error("delete user by id", e.message);
    res.json({ error: e.message });
  }
};

self.recoverPassword = async (req, res) => {
  try {
    const email = req.body.email;
    const recoverLink = config.link_recover_account + user.id;

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .is("deleted_at", null);

    if (!user) {
      throw new Error("User not found");
    }

    const html =
      '<div className="flex text-sm w-full px-4"><div className="w-full py-4 flex flex-col justify-start"><p className="p-2">Hola ' +
      user.name +
      '!</p><p className="p-2">Recupera tu contraseña haciendo <a href="' +
      recoverLink +
      '">click aqui</a></p></div></div>';

    await sendEmail(user.email, html);

    res.json(_.first(user));
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
};

self.medicalHistory = async (req, res) => {
  res.send({
    name: "Juan Pérez",
    records: [
      {
        date: "2024-03-15",
        notes: "Consulta por dolor abdominal. Se solicita ecografía.",
      },
      {
        date: "2024-04-02",
        notes: "Resultados normales. Se recomienda control en 6 meses.",
      },
      {
        date: "2024-04-10",
        notes: "Consulta de seguimiento. Paciente asintomático.",
      },
    ],
    links: [
      {
        date: "2024-03-15",
        url: "http://example.com/ecografia.pdf",
        description: "Ecografía abdominal",
      },
      {
        date: "2024-04-02",
        url: "http://example.com/resultados.pdf",
        description: "Resultados de laboratorio",
      },
    ],
  });
};

module.exports = self;
