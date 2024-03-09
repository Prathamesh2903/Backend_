import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import{User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js" 
import  jwt  from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshToken = async (userId)=>{
    try {
            const user =  await User.findById(userId)
            const accessToken = user.generateAccessToken()
            const refreshToken = user.refreshAccessToken()

            user.refreshToken = refreshToken
            await user.save({validateBeforeSave: false}) 

            return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req,res) =>{
    
     // get user details from frontend 
     // validation - not empty 
     // check if user already exists : username or email 
     // check for images , avatar 
     // upload them to cloudinary , avatar 
     // create user object - create entry in db 
     // remove password and refresh token field from response 
     // check for userCreation 
     // return response 


     const {fullName  , email , username , password}  = req.body
     console.log("EMAIL: ",email);

     if(
      [fullName,email,username,password].some((field)=>{
         field?.trim()===""
      })
     )
     {
         throw new ApiError(400,"Full Name is required")
     }

     const existedUser = await User.findOne({
         $or: [{username} , {email}]
     })

     if(existedUser)
     {
         throw new ApiError(409,"User Already Exists")
     }

     const avatarLocalPath = req.files?.avatar[0]?.path
     //const coverImagePath = req.files?.coverImage[0]?.path
     let coverImageLocalPath;
     if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
         coverImageLocalPath = req.files.coverImage[0].path
     }

     if(!avatarLocalPath)
     {
         throw new ApiError(400,"Avatar required")
     }

     const avatar = await uploadOnCloudinary(avatarLocalPath)
     const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    

     if(!avatar){
         throw new ApiError(400,"Avatar required")
     }

     const user = await User.create({
      fullName,
      avatar: avatar.url ,
      coverImage:coverImage?.url || "" ,
      email,
      password,
      username: username.toLowerCase() 
     })

     const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
     )

     if(!createdUser)
     {
         throw new ApiError(500,"something went wrong while registering user")
     }

     return res.status(201).json(
      new ApiResponse(200,createdUser,"User Registered Successfully")
     )

})

const loginUser = asyncHandler(async (req,res)=> {
        // get details from user 
        // check if user exists
        // password hashing 
        // check password correct 
        // access and refresh token 
        // send cookies 

        const {email ,username, password} = req.body

        if(!(username||email))
        {
            throw new ApiError(400,"username or email required")
        }

        const user = await User.findOne({
            $or: [{email} , {username}]
        })

        if(!user)
        {
            throw new ApiError(404,"User doesnot exist")
        }

        const isPasswordValid = await user.isPasswordCorrect(password)

        if(!isPasswordValid)
        {
            throw new ApiError(401,"Invalid Password Entered")
        }

        const {refreshToken , accessToken} = await generateAccessAndRefreshToken(user._id)

        const loggedInUser = await User.findById(user._id).
        select("-password -refreshToken")

        const options = {
            httpOnly : true ,
            secure : true 
        }

        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200 , 
                {
                    user :loggedInUser , accessToken , refreshToken
                },
                "User logged in successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req,res) => {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $unset: {
                    refreshToken : 1
                }
            },
            {
                new : true 
            }
        )

        const options = {
            httpOnly : true ,
            secure : true 
        }

        return res.
        status(200).
        clearCookie("accessToken" , options).
        clearCookie("refreshToken",options).
        json(new ApiResponse(200),{},"user logged out")
})

const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized Request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"Invalid Refresh Token")
        }
        
         if(incomingRefreshToken != user?.refreshToken){
            throw new ApiError(401,"Refresh Token is expired or used")
         }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res.
        status(200).
        cookie("accessToken",accessToken,options).
        cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(200,
                {accessToken,refreshToken:newRefreshToken},
                "access token refreshed successfully")
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword , newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect)
    {
        throw new ApiError(400,"Invalid Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(
        new ApiError(200,{},
            "NEW PASSWORD SET")
    )
})

const getCurrentUser = asyncHandler(async (req,res)=>{
    return res.status(200)
    .json(
        new ApiResponse(200,req.user,"current user fetched successfully")
    )
})


const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params

    if(!username?.trim)
    {
        throw new ApiError(400,"username is missing")
    }

    const channel  = await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriver",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribeTo:{
                    $size:"$subscribeTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscribers"]},
                        then :true,
                        else: false
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                username:1,
                channelsSubscribeTo:1,
                isSubscribed:1,
                subscribersCount:1,
                coverImage:1,
                email:1,
                avatar:1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404,"channel does not exists")
    }

    return res.status(200)
    .json(
        new ApiResponse(200,channel[0],"user channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async (req,res) => {
        const user = await User.aggregate([
            {
                $match:{
                    _id: new mongoose.Types.ObjectId(req.user._id)
                }
            },
            {
                $lookup:{
                    from: "videos",
                    localField:"watchHistory",
                    foreignField:"_id",
                    as:"watchHistory",
                    pipeline:[
                        {
                            $lookup:{
                                from:"users",
                                localField:"owner",
                                foreignField:"_id",
                                as:"owner" , 
                                pipeline:[
                                    {
                                        $project:{
                                            fullName:1,
                                            username:1,
                                            avatar:1
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields:{
                                owner:{
                                    $first:owner
                                }
                            }
                        }
                    ]
                }
            }
        ]) 

        return res.status(200)
        .json(new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetch successfully"
        ))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    getUserChannelProfile,
    getWatchHistory
}