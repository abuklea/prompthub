"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { signIn, signUp } from "../actions"
import { SignInSchema, SignUpSchema } from "../schemas"
import { z } from "zod"

export function AuthForm() {
  const [isSignIn, setIsSignIn] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [formError, setFormError] = useState<string>("")
  const form = useForm<z.infer<typeof SignInSchema> & Partial<z.infer<typeof SignUpSchema>>>({
    resolver: zodResolver(isSignIn ? SignInSchema : SignUpSchema) as any,
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  // Clear form error when user interacts with form
  useEffect(() => {
    const subscription = form.watch(() => {
      if (formError) {
        setFormError("")
      }
    })
    return () => subscription.unsubscribe()
  }, [form, formError])

  const toggleView = () => {
    setIsSignIn(!isSignIn)
    setFormError("") // Clear error when switching views
  }

  const onSubmit = async (values: z.infer<typeof SignInSchema> | z.infer<typeof SignUpSchema>) => {
    setIsLoading(true)
    setFormError("") // Clear any existing errors

    try {
      let result
      if (isSignIn) {
        result = await signIn(values as z.infer<typeof SignInSchema>)
      } else {
        result = await signUp(values as z.infer<typeof SignUpSchema>)
      }

      // Check if we got an error back
      if (result && !result.success) {
        const errorMessage = result.error || "An error occurred"
        setFormError(errorMessage)
        toast.error(errorMessage, { duration: 6000 })
        setIsLoading(false)
        return
      }

      // Success - show redirect message before redirect happens
      toast.success(isSignIn ? "Welcome back!" : "Account created!", { duration: 3000 })
      setIsRedirecting(true)
      // Redirect will happen from server action

    } catch (error) {
      // Unexpected client-side errors
      const errorMessage = "An unexpected error occurred"
      setFormError(errorMessage)
      toast.error(errorMessage, { duration: 6000 })
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete={isSignIn ? "current-password" : "new-password"}
                      placeholder="Enter your password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isSignIn && (
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Confirm your password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button
              className="w-full"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : (isSignIn ? "Sign In" : "Create Account")}
            </Button>
            {isRedirecting && (
              <div className="text-sm text-muted-foreground text-center mt-2">
                Redirecting to dashboard...
              </div>
            )}
            {formError && (
              <div className="text-sm text-destructive mt-2">
                {formError}
              </div>
            )}
          </form>
        </Form>
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
