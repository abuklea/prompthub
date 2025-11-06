"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn, signUp } from "../actions"
import { SignInSchema, SignUpSchema } from "../schemas"
import type { z } from "zod"
import { toast } from "sonner"

export function AuthForm() {
  const [isSignIn, setIsSignIn] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm({
    resolver: zodResolver(isSignIn ? SignInSchema : SignUpSchema),
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form

  const toggleView = () => {
    setIsSignIn(!isSignIn)
    form.reset()
  }

  const onSubmit = async (data: z.infer<typeof SignInSchema> | z.infer<typeof SignUpSchema>) => {
    setIsLoading(true)
    try {
      if (isSignIn) {
        await signIn({ email: data.email, password: data.password })
        toast.success("Signed in successfully!")
      } else {
        await signUp({ email: data.email, password: data.password })
        toast.success("Account created successfully!")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>{isSignIn ? "Sign In" : "Create Account"}</CardTitle>
        <CardDescription>
          {isSignIn ? "Enter your credentials to access your account." : "Enter your email and password to create an account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" {...register("email")} placeholder="Enter your email" disabled={isLoading} />
              {errors.email && <p className="text-red-500 text-xs">{errors.email.message as string}</p>}
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register("password")} placeholder="Enter your password" disabled={isLoading} />
              {errors.password && <p className="text-red-500 text-xs">{errors.password.message as string}</p>}
            </div>
            {!isSignIn && (
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" {...register("confirmPassword")} placeholder="Confirm your password" disabled={isLoading} />
                {errors.confirmPassword && <p className="text-red-500 text-xs">{errors.confirmPassword.message as string}</p>}
              </div>
            )}
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? "Loading..." : isSignIn ? "Sign In" : "Create Account"}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col">
        <p className="mt-4 text-xs text-center text-gray-700">
          {isSignIn ? "Don't have an account?" : "Already have an account?"}{" "}
          <span onClick={toggleView} className="text-blue-600 hover:underline cursor-pointer">
            {isSignIn ? "Sign Up" : "Sign In"}
          </span>
        </p>
      </CardFooter>
    </Card>
  )
}
