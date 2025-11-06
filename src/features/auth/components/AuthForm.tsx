"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn, signUp } from "../actions"

export function AuthForm() {
  const [isSignIn, setIsSignIn] = useState(true)

  const toggleView = () => setIsSignIn(!isSignIn)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (isSignIn) {
      await signIn({ email, password })
    } else {
      await signUp({ email, password })
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
        <form onSubmit={handleSubmit}>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" placeholder="Enter your email" />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="Enter your password" />
            </div>
            {!isSignIn && (
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input id="confirm-password" type="password" placeholder="Confirm your password" />
              </div>
            )}
            <Button className="w-full" type="submit">{isSignIn ? "Sign In" : "Create Account"}</Button>
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
