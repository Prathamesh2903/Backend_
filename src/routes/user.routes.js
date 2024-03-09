import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser } from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";


const userRouter  = Router()

userRouter.route("/register").post(
    upload.fields([
        {
            name :"avatar",
            maxCount:1,
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser)


userRouter.route("/login").post(loginUser)

// secured routes 
userRouter.route("/logout").post(verifyJWT , logoutUser)

userRouter.route("/refresh-token").post(refreshAccessToken)

userRouter.route("/changePassword").post(verifyJWT,changeCurrentPassword)

userRouter.route("/current-user").get(verifyJWT,getCurrentUser)

userRouter.route("/c/:username").get(verifyJWT,getUserChannelProfile)

userRouter.route("/history").get(verifyJWT,getWatchHistory)

export default userRouter