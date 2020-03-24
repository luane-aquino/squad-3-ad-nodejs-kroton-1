const { User } = require('../models')
const { Log } = require('../models')
const { generateHashedPassword, compareHash } = require('../utils/hashing')
const { schemaValidationForUsers, schemaValidationForUpdateUser } = require('../utils/validators')
const { decodeToken } = require('../utils/auth')
const { updateByItem } = require('../utils/updateUserValidator')

module.exports = {

  getAllLogs: async (req, res) => {
    try {
      const { locals: id } = req
      const { dataValues: { Logs } } = await User.findOne({
        where: { id },
        include: Log
      })

      if (Logs.length === 0) {
        return res.status(406).json({ message: 'There are no logs' })
      }

      return res.status(200).json({ total: Logs.length, Logs })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: 'Internal Server Error' })
    }
  },

  create: async (req, res) => {
    try {
      const { body: { name, email, password } } = req

      const validation = (await schemaValidationForUsers().isValid({
        name,
        email,
        password
      }))

      if (!validation) {
        return res.status(406).json({ message: 'Invalid data' })
      }

      const existsEmail = await User.findOne({
        where: { email }
      })

      if (existsEmail) {
        return res.status(409).json({ message: 'User email already exists.' })
      }

      const hashedPassword = await generateHashedPassword(password)

      if (typeof hashedPassword === 'string') {
        const { dataValues: { name: userName, email: userEmail, createdAt } } = await User.create({
          name,
          email,
          password: hashedPassword
        })

        return res.status(201).json({
          message: 'User created successfully!',
          data: { userName, userEmail, createdAt }
        })
      } else {
        return res.status(406).json({ message: 'Invalid data' })
      }
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: 'Internal Server Error' })
    }
  },

  update: async (req, res) => {
    try {
      const { body } = req
      const { authorization } = req.headers
      const { userId: { id } } = decodeToken(authorization)

      const dataToBeUpdated = []
      for (const obj in body) {
        if (dataToBeUpdated.indexOf(obj) === -1) {
          dataToBeUpdated.push(obj)
        }
      }

      const validation = (await schemaValidationForUpdateUser().isValid(body))
      if (!validation) {
        return res.status(406).json({ message: 'Invalid data' })
      }

      const user = await User.findOne({
        where: { id }
      })
      if (!user) {
        return res.status(204).json({ message: 'There is no user' })
      }

      if (dataToBeUpdated.indexOf('oldPassword') !== -1) {
        if (!await compareHash(body.oldPassword, user.password)) {
          return res.status(401).json({ message: 'Password does not match' })
        }

        const hashedPassword = await generateHashedPassword(body.newPassword)

        if (typeof hashedPassword === 'string') {
          body.password = hashedPassword
        } else {
          return res.status(406).json({ message: 'Invalid data' })
        }
      }

      const { status, message } = await updateByItem(dataToBeUpdated.join(), body, id)

      res.status(status).json({ message: message })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: 'Internal Server Error' })
    }
  },

  delete: async (req, res) => {
    try {
      const { locals: { id } } = req

      const userExists = await User.findOne({
        where: { id }
      })

      if (!userExists) {
        return res.status(204).json({ message: 'There is no user' })
      }

      await Log.destroy({
        where: { UserId: id }
      })

      await User.destroy({
        where: { id }
      })

      return res.status(200).json({ message: 'Deleted succesfully' })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: 'Internal Server Error' })
    }
  },

  hardDelete: async (req, res) => {
    try {
      const { locals: { id } } = req

      const userExists = await User.findOne({
        where: { id }
      })

      if (!userExists) {
        return res.status(204).json({ message: 'There is no user' })
      }

      await Log.destroy({
        where: { UserId: id }
      })

      await User.destroy({
        where: {
          id
        },
        force: true
      })

      return res.status(200).json({ message: 'Deleted successfully, this action cannot be undone' })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ message: 'Internal Server Error' })
    }
  },

  restore: async (req, res) => {
    const { locals: { token } } = req
    const { userId: { id } } = decodeToken(token)

    const user = await User.findOne({
      where: {
        id
      },
      paranoid: false
    })

    if (!user) {
      return res.status(204).json({ message: 'There is no user' })
    }

    await User.restore({
      where: { id }
    })

    return res.status(200).json({ message: 'User restored successfully.' })
  }
}
